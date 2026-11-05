# Daystream

A calendar you can write in. Every note is anchored to a day; the days are a
horizontal ruled rail; writing happens in a flat serif page that other people
can edit with you in real time. A month calendar jumps anywhere, and a single
note can be shared without opening the rest of its workspace.

Daystream is a mobile-first PWA. It runs as **one Node process on Railway**:
Express serves the built SPA, hosts the JSON API, and runs the Hocuspocus
WebSocket at `/collab`. Postgres is the only other dependency.

---

## Stack

| Layer | Choice |
| --- | --- |
| Client | Vite 8 + React 19 + TypeScript |
| Styling | Hand-written CSS (`src/styles.css`), tokens only, no framework |
| Server | Node 22+ / Express 5, plain ESM |
| Database | Postgres via `pg`, numbered SQL migrations applied at boot |
| Auth | 6-digit ID + 6-digit PIN, bcrypt, JWT access/refresh in HTTP-only cookies |
| Realtime | Yjs CRDTs over Hocuspocus 4 WebSockets (sync + awareness) |
| Editor | Tiptap 3 with input rules, task lists and collaborative carets |
| Offline | `y-indexeddb` per note + service-worker app shell |
| Hosting | Railway single service (`railway.json`), health check `/api/health` |
| Admin | Separate lazy-loaded `/admin` console, owner + administrator tiers |
| Navigation | 35-day ruled rail, month calendar, workspace sheet; three-column desktop workspace |

No realtime SaaS, no auth SaaS, no CDN fonts. Everything runs in the Railway
service or in the browser.

---

## Architecture

```
                    ┌──────────── one Railway service ────────────┐
  HTTPS ───────────▶│  server/index.mjs                           │
  WSS /collab ─────▶│    ├─ Express: /api/* + dist/ static         │
                    │    └─ Hocuspocus: Yjs sync + awareness       │
                    │                │                             │
                    │                ▼                             │
                    │        Postgres (Railway plugin)             │
                    │          users, workspaces, members          │
                    │          templates, notes, note_shares        │
                    │          (notes store bytea CRDT state)       │
                    └─────────────────────────────────────────────┘
```

The Yjs document is the source of truth for a note's text; `notes.content`
stores its binary state. Two projection columns (`title`, `excerpt`) are
rewritten on every store so the day and the global-pin tray are one indexed SQL query
instead of a decode of every note. Both are additive to the blueprint schema;
all specified columns and indexes are present.

### Rooms

| Room | Who may join |
| --- | --- |
| `private-<note_id>` | the note's owner, in a workspace with one member |
| `shared-<workspace_id>-<note_id>` | members of that workspace, or a direct sharee of that note |
| `presence-<workspace_id>` | members of that workspace (awareness only) |

The browser asks `GET /api/collab/token?noteId=…` (or `?workspaceId=…` for
presence). The server chooses the room, mints a 120-second HS256 token naming
that exact room, and Hocuspocus re-checks ownership, membership or the note
share in `onAuthenticate`. A token can never be replayed against another room,
and the client cannot choose a channel. A shared channel is used when the
workspace has more than one member **or** the note has any direct share.

### Presence, in two layers

- **Footprint:** every open client joins the workspace presence room and
  publishes `{ user, footprint: { date, noteId } }` through Yjs awareness. The
  date rail reads those states to draw 5px dots. Nothing is written to Postgres.
- **Caret:** the note's own room awareness carries `{ user }`; Tiptap's
  collaboration caret renders a 1px cursor labelled with the person's display
  name.

Both are open WebSocket state. There is no polling anywhere in the product.

---

## Auth lifecycle

- **Create:** choose a real name, then a PIN twice. The server allocates a
  random unused 6-digit ID, hashes the PIN with bcrypt, creates a `Personal`
  workspace and an `admin` membership, and shows the ID once. The first account
  on an install is the owner (`is_admin` + `is_super_admin`).
- **Names:** display names are unique case-insensitively and are how a workspace
  invite finds someone. Invites accept a name or a six-digit ID. A member can
  change their own display name from Account; the ID stays fixed.
- **Sign in:** ID pad → PIN pad, auto-submitting at six digits. Five wrong PINs
  lock that account for five minutes (in-memory, per service instance).
- **Tokens:** 15-minute access JWT and a 7-day refresh JWT, both HTTP-only. The
  refresh cookie is scoped to `/api/auth`. The session start time (`sst`) is
  carried in every token and never moves forward.
- **Seven-day wall:** refresh only ever shrinks the remaining lifetime. At seven
  days the cookies are cleared and the full ID + PIN sequence is required.
- **Lock:** four hours idle, or four hours hidden in the background, locks the
  view. Unlock is PIN-only. A PBKDF2-SHA256 digest (150k iterations, per-device
  salt) lives in IndexedDB, so a matching PIN opens the view immediately; the
  server unlock still runs in the background to rotate the access token and
  enforce the lockout. A reload inside the same foreground session resumes
  directly; a new tab asks for the PIN.
- **Sign out** clears cookies and the local digest.

PINs cannot be recovered. Losing both the ID and the session means the notebook
is unreachable; that is stated on the auth screen.

### Administration

`/admin` is a separate, lazy-loaded page — the notebook never grows admin
chrome. It shares the session cookie and re-checks the account on every
management call.

| Tier | Can |
| --- | --- |
| Owner (`is_super_admin`) | list accounts, change any member's ID, promote or demote administrators |
| Administrator (`is_admin`) | list accounts, change a member's ID (not another administrator's) |
| Member | use the notebook only |

The owner cannot be demoted, and nobody can change their own ID. Changing an ID
cascades to memberships, notes, note shares and templates; the target's current
sessions end and they sign in with the new ID. Accounts that predate migration
002 keep a unique `Member <id>` placeholder and can still be invited by ID.

### Sharing

A workspace invite opens every note in that workspace. A **note share** is
narrower: one person, one note. It lives in `note_shares`, survives as a "Shared
with you" tray in that person's own app, and does not grant the workspace,
presence, the tray, pinning, moving or deletion. The note's owner or a workspace
editor manages the share from the note's Share sheet. Shares are editor-only in
the UI today; the `viewer` role is supported by the schema but not offered.

A **public link** is different again: a random, revocable token in
`note_public_links` that opens `/p/<token>` for anyone. The public page is
outside the session boundary, renders the stored Yjs document read-only, and
never grants editing, workspace presence, a share entry, or access to any other
note. The endpoint returns only the note body and its date/workspace metadata.
The Share sheet can copy the link or turn it off; revoking deletes the token
immediately. Links survive note shares, and disappear when the note is deleted.

---

## Writing

Markdown-ish markers are consumed when you press space: `# `, `## `, `- `,
`* `, `1. `, `> `, `[] ` / `[ ] `. Enter on a checkbox creates the next one;
Enter on an empty checkbox removes it and returns a paragraph. Tab/Shift-Tab
indent on desktop; swipe right/left does the same on touch, with Outdent/Indent
buttons in the footer as the keyboard-free twin. Paragraphs and headings can
step in up to six levels; list items nest structurally. A persistent formatting
bar adds bold, italic, underline, paragraph/H1/H2, and bullet/number/checklist
toggles.

Text goes to the Yjs document and IndexedDB before the network. The editor shows
`Live` when synced and `Saved on this device` when not; the document syncs on
reconnect. The footer's Outdent/Indent controls are enabled only when the cursor
is on a list line that can move; swipe right/left performs the same pair on
touch.

### Templates

Three starter templates ship with the install. Any note can be turned into a
personal template with **Save as template**: its headings, paragraphs, bullets,
checkboxes and quotes are flattened into the server's block structure, and only
its creator sees it. Starting from a template seeds a new note; it never mutates
the template.

## Pinning

| Mode | Effect |
| --- | --- |
| `none` | ordinary note in its day, ordered by `sort_order` |
| `global` | leaves the day; lives in the Global pins tray above the rail on every date |
| `day` | stays on its date and takes rank zero (`sort_order` below every ordinary note) |

Unpinning a day-pinned note sends it to the end of its day's stack. Moving a
note to another date gives it the end rank there (or rank zero if it is
day-pinned).

---

## Local development

Requires Node 22+.

```bash
npm install
cp .env.example .env.local      # set AUTH_SECRET (32+ random bytes)
```

Postgres, option A — PGlite, no install (what the smoke test uses):

```bash
# terminal 1
npm run dev:db
# terminal 2
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
export AUTH_SECRET=$(openssl rand -base64 32)
npm run dev
```

Option B — any Postgres:

```bash
docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
npm run dev
```

`npm run dev` runs Vite in middleware mode and the Hocuspocus socket on the same
port, so the app, the API and `/collab` share an origin. Migrations run at boot.

### Environment

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Railway Postgres reference in production |
| `AUTH_SECRET` | yes | 32+ random bytes; signs access, refresh and collab tokens |
| `AUTH_URL` | prod | public origin; used for secure cookie detection behind proxies |
| `COOKIE_SECURE` | no | force `Secure` cookies if the proxy does not send `x-forwarded-proto` |
| `APP_TIMEZONE` | no | informational; the client owns its local day |
| `PORT` | auto | Railway injects it |
| `PREVIEW_HOSTNAME` | dev | extra allowed Vite host(s), comma separated |

Never commit `.env`, `.env.local`, `.runtime/` or `.pgdata/`; all are ignored.

---

## Deploying to Railway

1. Create a project → **Deploy from GitHub** → this repository.
2. Add the **PostgreSQL** plugin to the same project.
3. On the service, set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` = `openssl rand -base64 32`
   - `AUTH_URL` = `https://<your-domain>`
4. Deploy. `railway.json` builds with `npm install && npm run build` (Vite emits
   `dist/` and `prebuild` generates the PWA icons) and starts `npm start`.
5. Migrations apply at boot and are tracked in `_daystream_migrations`. If the
   Postgres volume is wiped while the service is running, the next API call
   re-applies them to the empty database and retries; restarting also works.

Health check is `/api/health` (also verifies the database). One port serves
HTTPS and the WSS socket; no sticky sessions are needed.

> **Clean slate:** `db/migrations/001_init.sql` replaces the previous
> product's tables (`things`, `yjs_documents`, legacy `users`, …) before
> creating the current schema. Deploying it against the old production database
> will drop that old data. That is intentional for this rebuild.

---

## Verification

```bash
npm run typecheck      # tsc --noEmit
npm run build          # vite build (+ generated icons)
node scripts/smoke.mjs # needs a running server; see below
```

`scripts/smoke.mjs` (63 checks) exercises: real-name account creation,
duplicate/invalid name rejection, self-service display-name changes, session
cookies, note creation, day-pin order, global pin tray, name-based workspace
invites, both admin tiers,
promotion/demotion, cascading ID changes, channel selection (`private-` →
`shared-` after an invite or note share), direct note sharing with an outsider,
the sharee's shared tray and channel, denied pinning/deletion for a sharee,
share revocation, public-link creation, anonymous read-only access, unknown and
revoked public tokens, Yjs persistence through the title projection, live
document sync between two sockets, footprint awareness, outsider denial, token refresh,
PIN unlock and logout. Admin checks promote a freshly created test account
through `DATABASE_URL`; the suite needs that variable.

```bash
DATABASE_URL=… AUTH_SECRET=… PORT=3100 node server/index.mjs &
SMOKE_URL=http://127.0.0.1:3100 node scripts/smoke.mjs
```

## Desktop

At 1100px and wider the day is the centre of a three-column workspace: the
month calendar and people sit on the left, and global pins/shared notes sit on
the right. The rail and day use the centre column; the side columns collapse
away below that width. Opening a note on desktop keeps all three columns in
place: the editor fills only the centre column below the rail, with the
month/people column and the global pins/shared column still visible and usable.
On narrower screens
the editor remains a full-screen surface. The phone layout remains the primary
one.

## Layout

```
db/migrations/      numbered SQL, applied at boot
server/index.mjs    Express + Vite/static + WebSocket upgrade at /collab
server/api.mjs      auth, bootstrap, notes, pinning, workspaces, templates, tokens
server/auth.mjs     bcrypt, JWT cookies, session wall, PIN throttle, admin guards
server/names.mjs    display-name validation and invite lookup
server/collab.mjs   Hocuspocus auth, bytea load/store, title projection
server/rooms.mjs    room naming and parsing
server/templates.mjs template → Yjs seeding, title/excerpt extraction
src/                React SPA: session, day, rail, calendar, editor, sheets
src/admin/          standalone admin console (own route, lazy chunk, CSS)
db/migrations/003_note_shares.sql  per-note access, additive to membership
db/migrations/004_public_note_links.sql  revocable anonymous read-only links
scripts/            PGlite dev database, smoke test, icon generator
public/             manifest, service worker, generated icons
```

## Known limits

- Presence and the PIN throttle are in memory: one service instance is assumed
  (which is what `railway.json` deploys). Scaling horizontally needs Redis or a
  shared store.
- The local PIN digest is a convenience, not a second factor: someone with the
  unlocked device and the IndexedDB contents can brute-force a 6-digit PIN
  offline. The server lockout still applies to online attempts.
- Creating a note, moving it, or pinning it requires the server. Editing existing
  notes does not.
- A note is visible to every member of its workspace; there is no per-note ACL
  inside a workspace.
- Administration covers listing, administrator roles and ID changes. It does not
  disable or delete accounts or reset PINs. Members can edit their own display
  name, but administrators cannot edit someone else's.
- There is no search, backlinks, attachments, reminders or calendar import yet.
