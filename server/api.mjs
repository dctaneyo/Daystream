import { randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import { SignJWT } from "jose";
import { pool, query } from "./db.mjs";
import {
  checkPin,
  clearFailures,
  clearSessionCookies,
  dummyPinHash,
  findUser,
  hashPin,
  issueTokens,
  readRefresh,
  recordFailure,
  requireAdmin,
  requireAuth,
  requireSuperAdmin,
  sameOrigin,
  secretKey,
  SESSION_TTL_MS,
  throttleRemaining,
} from "./auth.mjs";
import {
  COLLAB_AUDIENCE,
  COLLAB_ISSUER,
  isUuid,
  presenceRoom,
  privateRoom,
  sharedRoom,
} from "./rooms.mjs";
import { cleanLookup, normalizeDisplayName } from "./names.mjs";
import {
  seedFromStructure,
  structureBlocks,
  summarizeStructure,
} from "./templates.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PIN_RE = /^\d{6}$/;

const NOTE_COLUMNS = `id,
  user_id AS "userId",
  workspace_id AS "workspaceId",
  title,
  excerpt,
  assigned_date AS "assignedDate",
  sort_order AS "sortOrder",
  pin_mode AS "pinMode",
  template_id AS "templateId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

const readDate = (value) => {
  const text = String(value ?? "");
  return DATE_RE.test(text) ? text : null;
};

async function listWorkspaces(userId) {
  const { rows } = await query(
    `SELECT w.id, w.name, wm.role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
      ORDER BY w.created_at ASC`,
    [userId],
  );
  return rows;
}

async function roleIn(workspaceId, userId) {
  const { rows } = await query(
    "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    [workspaceId, userId],
  );
  return rows[0]?.role ?? null;
}

async function noteAccess(noteId, userId) {
  const { rows } = await query(
    `SELECT n.id, n.user_id, n.workspace_id, n.assigned_date, n.sort_order, n.pin_mode,
            wm.role AS my_role,
            (SELECT count(*)::int FROM workspace_members x
              WHERE x.workspace_id = n.workspace_id) AS member_count
       FROM notes n
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = n.workspace_id AND wm.user_id = $2
      WHERE n.id = $1`,
    [noteId, userId],
  );
  const note = rows[0];
  if (!note) return null;
  if (!note.my_role && note.user_id !== userId) return null;
  return {
    note,
    canWrite: note.my_role !== "viewer",
    memberCount: note.member_count,
  };
}

export const api = Router();

api.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

api.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

api.get("/version", (req, res) => {
  res.json({ build: process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev" });
});

/* ------------------------------- accounts ------------------------------- */

api.post("/auth/register", sameOrigin, async (req, res) => {
  const pin = String(req.body?.pin ?? "");
  const displayName = normalizeDisplayName(req.body?.displayName);
  if (!PIN_RE.test(pin)) {
    res.status(400).json({ error: "pin_format" });
    return;
  }
  if (!displayName) {
    res.status(400).json({ error: "invalid_name" });
    return;
  }

  const pinHash = await hashPin(pin);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize registration so exactly one account can become the owner.
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const count = await client.query("SELECT count(*)::int AS n FROM users");
    const isAdmin = count.rows[0].n === 0;

    const clash = await client.query(
      "SELECT 1 FROM users WHERE lower(display_name) = lower($1)",
      [displayName],
    );
    if (clash.rowCount) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "name_taken" });
      return;
    }

    let userId = null;
    for (let attempt = 0; attempt < 20 && !userId; attempt += 1) {
      const candidate = String(100000 + randomInt(900000));
      const inserted = await client.query(
        `INSERT INTO users (user_id, pin_hash, display_name, is_admin, is_super_admin)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT DO NOTHING
         RETURNING user_id`,
        [candidate, pinHash, displayName, isAdmin],
      );
      if (inserted.rowCount) userId = inserted.rows[0].user_id;
    }

    if (!userId) {
      await client.query("ROLLBACK");
      res.status(503).json({ error: "id_space_exhausted" });
      return;
    }

    const workspace = await client.query(
      "INSERT INTO workspaces (name) VALUES ('Personal') RETURNING id, name",
    );
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [workspace.rows[0].id, userId],
    );
    await client.query("COMMIT");

    const session = {
      id: randomBytes(9).toString("base64url"),
      startedAt: Date.now(),
    };
    const expiry = await issueTokens(req, res, { userId, isAdmin }, session);

    res.status(201).json({
      user: { userId, displayName, isAdmin, isSuperAdmin: isAdmin },
      session: expiry,
      workspace: {
        id: workspace.rows[0].id,
        name: workspace.rows[0].name,
        role: "admin",
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (
      error?.code === "23505" &&
      String(error.constraint ?? "").includes("display_name")
    ) {
      res.status(409).json({ error: "name_taken" });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

api.post("/auth/login", sameOrigin, async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const pin = String(req.body?.pin ?? "");
  if (!PIN_RE.test(userId) || !PIN_RE.test(pin)) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const key = `pin:${userId}`;
  const retryAfterMs = throttleRemaining(key);
  if (retryAfterMs > 0) {
    res.status(429).json({ error: "too_many_attempts", retryAfterMs });
    return;
  }

  const user = await findUser(userId);
  // Compare against a dummy hash for unknown IDs so a miss costs the same as a
  // wrong PIN (no account enumeration by timing).
  const matches = await checkPin(pin, user?.pin_hash ?? (await dummyPinHash()));

  if (!user || !matches) {
    recordFailure(key);
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  clearFailures(key);
  const session = { id: randomBytes(9).toString("base64url"), startedAt: Date.now() };
  const expiry = await issueTokens(
    req,
    res,
    { userId: user.user_id, isAdmin: user.is_admin === true },
    session,
  );
  res.json({
    user: {
      userId: user.user_id,
      displayName: user.display_name,
      isAdmin: user.is_admin === true,
      isSuperAdmin: user.is_super_admin === true,
    },
    session: expiry,
  });
});

api.post("/auth/unlock", sameOrigin, async (req, res) => {
  const pin = String(req.body?.pin ?? "");
  const refresh = await readRefresh(req);
  if (!refresh) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const startedAt = Number(refresh.sst) || 0;
  if (!startedAt || Date.now() > startedAt + SESSION_TTL_MS) {
    clearSessionCookies(req, res);
    res.status(401).json({ error: "session_expired" });
    return;
  }

  const userId = String(refresh.sub);
  if (!PIN_RE.test(pin)) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const key = `pin:${userId}`;
  const retryAfterMs = throttleRemaining(key);
  if (retryAfterMs > 0) {
    res.status(429).json({ error: "too_many_attempts", retryAfterMs });
    return;
  }

  const user = await findUser(userId);
  const matches = await checkPin(pin, user?.pin_hash ?? (await dummyPinHash()));
  if (!user || !matches) {
    recordFailure(key);
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  clearFailures(key);
  const expiry = await issueTokens(
    req,
    res,
    { userId, isAdmin: user.is_admin === true },
    { id: String(refresh.sid ?? ""), startedAt },
  );
  res.json({ session: expiry });
});

api.post("/auth/refresh", sameOrigin, async (req, res) => {
  const refresh = await readRefresh(req);
  if (!refresh) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const startedAt = Number(refresh.sst) || 0;
  if (!startedAt || Date.now() > startedAt + SESSION_TTL_MS) {
    clearSessionCookies(req, res);
    res.status(401).json({ error: "session_expired" });
    return;
  }

  const user = await findUser(String(refresh.sub));
  if (!user) {
    clearSessionCookies(req, res);
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  try {
    await issueTokens(
      req,
      res,
      { userId: user.user_id, isAdmin: user.is_admin === true },
      { id: String(refresh.sid ?? ""), startedAt },
    );
  } catch (error) {
    if (error?.code === "session_expired") {
      clearSessionCookies(req, res);
      res.status(401).json({ error: "session_expired" });
      return;
    }
    throw error;
  }
  res.status(204).end();
});

api.post("/auth/logout", sameOrigin, (req, res) => {
  clearSessionCookies(req, res);
  res.status(204).end();
});

api.get("/me", requireAuth, async (req, res) => {
  const user = await findUser(req.auth.userId);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const workspaces = await listWorkspaces(req.auth.userId);
  res.json({
    user: {
      userId: user.user_id,
      displayName: user.display_name,
      isAdmin: user.is_admin === true,
      isSuperAdmin: user.is_super_admin === true,
    },
    session: { endsAt: req.auth.sessionStartedAt + SESSION_TTL_MS },
    workspaces,
  });
});

/* ------------------------------- bootstrap ------------------------------ */

api.get("/bootstrap", requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const account = await findUser(userId);
  if (!account) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const date = readDate(req.query.date);
  if (!date) {
    res.status(400).json({ error: "date_required" });
    return;
  }
  const from = readDate(req.query.from) ?? date;
  const to = readDate(req.query.to) ?? date;

  let workspaces = await listWorkspaces(userId);
  if (workspaces.length === 0) {
    const created = await query(
      "INSERT INTO workspaces (name) VALUES ('Personal') RETURNING id, name",
    );
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [created.rows[0].id, userId],
    );
    workspaces = [{ ...created.rows[0], role: "admin" }];
  }

  const requested = String(req.query.workspace ?? "");
  const workspace = workspaces.find((entry) => entry.id === requested) ?? workspaces[0];

  const [day, pinned, activity, members, templates] = await Promise.all([
    query(
      `SELECT ${NOTE_COLUMNS}
         FROM notes
        WHERE workspace_id = $1
          AND assigned_date = $2
          AND pin_mode <> 'global'
        ORDER BY (pin_mode = 'day') DESC, sort_order ASC, created_at ASC`,
      [workspace.id, date],
    ),
    query(
      `SELECT ${NOTE_COLUMNS}
         FROM notes
        WHERE workspace_id = $1 AND pin_mode = 'global'
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 40`,
      [workspace.id],
    ),
    query(
      `SELECT assigned_date AS date, count(*)::int AS count
         FROM notes
        WHERE workspace_id = $1
          AND pin_mode <> 'global'
          AND assigned_date BETWEEN $2 AND $3
        GROUP BY 1`,
      [workspace.id, from, to],
    ),
    query(
      `SELECT wm.user_id AS "userId", u.display_name AS "displayName", wm.role
         FROM workspace_members wm
         JOIN users u ON u.user_id = wm.user_id
        WHERE wm.workspace_id = $1
        ORDER BY wm.role ASC, lower(u.display_name) ASC`,
      [workspace.id],
    ),
    query(
      `SELECT id, title, structure
         FROM templates
        WHERE created_by IS NULL OR created_by = $1
        ORDER BY title ASC`,
      [userId],
    ),
  ]);

  res.json({
    user: {
      userId,
      displayName: account.display_name,
      isAdmin: account.is_admin === true,
      isSuperAdmin: account.is_super_admin === true,
    },
    session: { endsAt: req.auth.sessionStartedAt + SESSION_TTL_MS },
    workspace,
    workspaces,
    members: members.rows,
    templates: templates.rows.map((row) => ({
      id: row.id,
      title: row.title,
      blocks: structureBlocks(row.structure),
    })),
    day: { date, notes: day.rows },
    pinned: pinned.rows,
    activity: activity.rows,
  });
});

/* --------------------------------- notes -------------------------------- */

api.post("/notes", requireAuth, sameOrigin, async (req, res) => {
  const body = req.body ?? {};
  const assignedDate = readDate(body.assignedDate);
  const workspaceId = String(body.workspaceId ?? "");

  if (!assignedDate || !isUuid(workspaceId)) {
    res.status(400).json({ error: "invalid_note" });
    return;
  }

  const role = await roleIn(workspaceId, req.auth.userId);
  if (!role) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (role === "viewer") {
    res.status(403).json({ error: "read_only" });
    return;
  }

  let template = null;
  if (body.templateId) {
    if (!isUuid(body.templateId)) {
      res.status(400).json({ error: "invalid_template" });
      return;
    }
    const found = await query(
      `SELECT id, structure FROM templates
        WHERE id = $1 AND (created_by IS NULL OR created_by = $2)`,
      [body.templateId, req.auth.userId],
    );
    template = found.rows[0] ?? null;
    if (!template) {
      res.status(404).json({ error: "template_not_found" });
      return;
    }
  }

  const blocks = structureBlocks(template?.structure);
  const summary = summarizeStructure(blocks);
  const content = blocks.length ? Buffer.from(seedFromStructure(blocks)) : null;
  const rank = await query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1024 AS next
       FROM notes WHERE workspace_id = $1 AND assigned_date = $2`,
    [workspaceId, assignedDate],
  );

  const inserted = await query(
    `INSERT INTO notes
       (user_id, workspace_id, content, assigned_date, sort_order, pin_mode, template_id, title, excerpt)
     VALUES ($1, $2, $3, $4, $5, 'none', $6, $7, $8)
     RETURNING ${NOTE_COLUMNS}`,
    [
      req.auth.userId,
      workspaceId,
      content,
      assignedDate,
      rank.rows[0].next,
      template?.id ?? null,
      summary.title,
      summary.excerpt,
    ],
  );

  res.status(201).json(inserted.rows[0]);
});

api.patch("/notes/:id", requireAuth, sameOrigin, async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const access = await noteAccess(req.params.id, req.auth.userId);
  if (!access) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!access.canWrite) {
    res.status(403).json({ error: "read_only" });
    return;
  }

  const body = req.body ?? {};
  const pinMode = body.pinMode === undefined ? null : String(body.pinMode);
  if (pinMode && !["none", "global", "day"].includes(pinMode)) {
    res.status(400).json({ error: "invalid_pin_mode" });
    return;
  }
  const assignedDate =
    body.assignedDate === undefined ? null : readDate(body.assignedDate);
  if (body.assignedDate !== undefined && !assignedDate) {
    res.status(400).json({ error: "invalid_date" });
    return;
  }
  if (pinMode === null && assignedDate === null) {
    res.status(400).json({ error: "nothing_to_update" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT ${NOTE_COLUMNS} FROM notes WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    const note = current.rows[0];
    if (!note) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "not_found" });
      return;
    }

    const nextDate = assignedDate ?? note.assignedDate;
    const nextMode = pinMode ?? note.pinMode;
    const moving = Boolean(assignedDate && assignedDate !== note.assignedDate);
    let nextOrder = note.sortOrder;

    if (nextMode === "day") {
      // A day pin owns rank zero: it floats above every ordinary note on that
      // date, and unpinning sends it back to the end of the stack.
      const top = await client.query(
        `SELECT COALESCE(MIN(sort_order), 0) - 1024 AS next
           FROM notes
          WHERE workspace_id = $1 AND assigned_date = $2 AND id <> $3`,
        [note.workspaceId, nextDate, req.params.id],
      );
      nextOrder = top.rows[0].next;
    } else if (moving || note.pinMode === "day") {
      const end = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1024 AS next
           FROM notes
          WHERE workspace_id = $1 AND assigned_date = $2 AND id <> $3`,
        [note.workspaceId, nextDate, req.params.id],
      );
      nextOrder = end.rows[0].next;
    }

    const updated = await client.query(
      `UPDATE notes
          SET assigned_date = $2, sort_order = $3, pin_mode = $4, updated_at = now()
        WHERE id = $1
        RETURNING ${NOTE_COLUMNS}`,
      [req.params.id, nextDate, nextOrder, nextMode],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

api.delete("/notes/:id", requireAuth, sameOrigin, async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const access = await noteAccess(req.params.id, req.auth.userId);
  if (!access) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!access.canWrite) {
    res.status(403).json({ error: "read_only" });
    return;
  }
  await query("DELETE FROM notes WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

/* ------------------------------ workspaces ------------------------------ */

api.get("/workspaces", requireAuth, async (req, res) => {
  res.json(await listWorkspaces(req.auth.userId));
});

api.post("/workspaces", requireAuth, sameOrigin, async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 80);
  if (!name) {
    res.status(400).json({ error: "name_required" });
    return;
  }
  const created = await query(
    "INSERT INTO workspaces (name) VALUES ($1) RETURNING id, name",
    [name],
  );
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [created.rows[0].id, req.auth.userId],
  );
  res.status(201).json({ ...created.rows[0], role: "admin" });
});

api.post("/workspaces/:id/members", requireAuth, sameOrigin, async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const myRole = await roleIn(req.params.id, req.auth.userId);
  if (myRole !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const identifier = String(
    req.body?.identifier ?? req.body?.userId ?? "",
  ).trim();
  const role = String(req.body?.role ?? "editor");
  if (!identifier) {
    res.status(400).json({ error: "invalid_user" });
    return;
  }
  if (!["admin", "editor", "viewer"].includes(role)) {
    res.status(400).json({ error: "invalid_role" });
    return;
  }

  // A six-digit string is an ID; anything else is a display name. Names are
  // unique case-insensitively, so the lookup can only ever return one person.
  let target = null;
  if (PIN_RE.test(identifier)) {
    target = await findUser(identifier);
  } else {
    const name = cleanLookup(identifier);
    if (name) {
      const { rows } = await query(
        "SELECT user_id, display_name FROM users WHERE lower(display_name) = lower($1)",
        [name],
      );
      target = rows[0] ?? null;
    }
  }
  if (!target) {
    res.status(404).json({ error: "no_such_user" });
    return;
  }

  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, target.user_id, role],
  );
  res.json({
    userId: target.user_id,
    displayName: target.display_name,
    role,
  });
});

/* ------------------------------- templates ------------------------------ */

api.get("/templates", requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, structure
       FROM templates
      WHERE created_by IS NULL OR created_by = $1
      ORDER BY title ASC`,
    [req.auth.userId],
  );
  res.json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      blocks: structureBlocks(row.structure),
    })),
  );
});

api.post("/templates", requireAuth, sameOrigin, async (req, res) => {
  const title = String(req.body?.title ?? "").trim().slice(0, 255);
  const blocks = structureBlocks({ blocks: req.body?.blocks });
  if (!title || blocks.length === 0) {
    res.status(400).json({ error: "invalid_template" });
    return;
  }
  const { rows } = await query(
    `INSERT INTO templates (title, structure, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, title`,
    [title, { blocks }, req.auth.userId],
  );
  res.status(201).json({ ...rows[0], blocks });
});

/* --------------------------- collaboration ------------------------------ */

api.get("/collab/token", requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const noteId = String(req.query.noteId ?? "");
  const workspaceQuery = String(req.query.workspaceId ?? "");

  let room;
  let workspaceId;
  let noteRef = null;

  if (workspaceQuery) {
    if (!isUuid(workspaceQuery)) {
      res.status(400).json({ error: "invalid_workspace" });
      return;
    }
    if (!(await roleIn(workspaceQuery, userId))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    workspaceId = workspaceQuery;
    room = presenceRoom(workspaceId);
  } else {
    if (!isUuid(noteId)) {
      res.status(400).json({ error: "invalid_note" });
      return;
    }
    const access = await noteAccess(noteId, userId);
    if (!access) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    workspaceId = access.note.workspace_id;
    noteRef = access.note.id;
    // A note in a workspace with collaborators uses the shared channel; a
    // solo workspace keeps the private channel. The client cannot choose.
    room =
      access.memberCount > 1
        ? sharedRoom(workspaceId, noteRef)
        : privateRoom(noteRef);
  }

  const token = await new SignJWT({
    room,
    wid: workspaceId,
    typ: "collab",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(COLLAB_ISSUER)
    .setAudience(COLLAB_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 120)
    .sign(secretKey());

  res.json({ token, room });
});

/* --------------------------- administration ----------------------------- */

const ADMIN_USER_COLUMNS = `user_id AS "userId",
  display_name AS "displayName",
  is_admin AS "isAdmin",
  is_super_admin AS "isSuperAdmin",
  created_at AS "createdAt"`;

api.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const search = String(req.query.q ?? "").trim().slice(0, 60);
  const { rows } = await query(
    `SELECT ${ADMIN_USER_COLUMNS}
       FROM users
      WHERE $1 = '' OR user_id LIKE $2 OR display_name ILIKE $2
      ORDER BY is_super_admin DESC, is_admin DESC, lower(display_name) ASC
      LIMIT 200`,
    [search, `%${search}%`],
  );
  res.json({
    users: rows,
    viewer: {
      userId: req.auth.userId,
      isSuperAdmin: req.auth.isSuperAdmin === true,
    },
  });
});

/**
 * A six-digit ID is mutable. The foreign keys cascade, so memberships, notes
 * and templates follow the person. The old token becomes unusable because its
 * subject no longer exists; the console says so before the change is saved.
 */
api.patch("/admin/users/:id/id", requireAuth, requireAdmin, sameOrigin, async (req, res) => {
  const currentId = String(req.params.id);
  const nextId = String(req.body?.userId ?? "");
  if (!PIN_RE.test(currentId) || !PIN_RE.test(nextId)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  if (currentId === nextId) {
    res.status(400).json({ error: "same_id" });
    return;
  }
  if (currentId === req.auth.userId) {
    res.status(403).json({ error: "cannot_change_self" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT user_id, display_name, is_admin, is_super_admin
         FROM users WHERE user_id = $1 FOR UPDATE`,
      [currentId],
    );
    const target = found.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "not_found" });
      return;
    }
    // An administrator manages members; only the owner may touch another
    // administrator's identity.
    if (target.is_admin && !req.auth.isSuperAdmin) {
      await client.query("ROLLBACK");
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const clash = await client.query("SELECT 1 FROM users WHERE user_id = $1", [
      nextId,
    ]);
    if (clash.rowCount) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "id_taken" });
      return;
    }

    const updated = await client.query(
      `UPDATE users SET user_id = $2 WHERE user_id = $1
       RETURNING ${ADMIN_USER_COLUMNS}`,
      [currentId, nextId],
    );
    await client.query("COMMIT");
    res.json({ user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "23505" || error?.code === "23503") {
      res.status(409).json({ error: "id_taken" });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

api.patch(
  "/admin/users/:id/admin",
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  sameOrigin,
  async (req, res) => {
    const targetId = String(req.params.id);
    const isAdmin = req.body?.isAdmin;
    if (!PIN_RE.test(targetId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    if (typeof isAdmin !== "boolean") {
      res.status(400).json({ error: "invalid_role" });
      return;
    }
    if (targetId === req.auth.userId) {
      res.status(403).json({ error: "cannot_change_owner" });
      return;
    }

    const target = await findUser(targetId);
    if (!target) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (target.is_super_admin) {
      res.status(403).json({ error: "cannot_change_owner" });
      return;
    }

    const { rows } = await query(
      `UPDATE users SET is_admin = $2 WHERE user_id = $1
       RETURNING ${ADMIN_USER_COLUMNS}`,
      [targetId, isAdmin],
    );
    res.json({ user: rows[0] });
  },
);

api.use((req, res) => {
  res.status(404).json({ error: "not_found" });
});
