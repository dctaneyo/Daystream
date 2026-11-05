# Project instructions

## Ship every change

- After any code change, **commit and push to `main`** so Railway redeploys immediately. Do not
  leave finished work uncommitted.
- Verify before pushing: `npx tsc --noEmit`, `npm run build`, and `node scripts/smoke.mjs` against a
  running server for anything touching auth, notes, realtime or the schema.
- Keep commit messages descriptive of the intent, not a file list.

## Secrets

- Never commit secrets. `.env`, `.env.local`, `.runtime/` and `.pgdata/` are gitignored.
- Production config lives in Railway service variables: `DATABASE_URL`, `AUTH_SECRET`, and
  optionally `AUTH_URL`, `APP_TIMEZONE`, `COOKIE_SECURE`.
- The sandbox reads a GitHub token from `.env.local` as a project secret. Never echo it, and never
  write it into a tracked file.

## Stack notes

- Single Railway service, one port: `server/index.mjs` serves the Vite build and hosts the
  Hocuspocus WebSocket at `/collab`. Migrations run at boot; there is no separate release step.
- The client is a Vite + React SPA (`src/`). There is no SSR and no Next.js.
- `db/migrations/*.sql` are append-only. Add a new numbered file instead of editing an applied one.
  Migration `001_init.sql` is a deliberate clean slate and drops the previous product's tables.
- Server code is plain ESM in `server/`. It is not typechecked by `tsc`; keep it small and explicit.
- Postgres `date` values are returned as `YYYY-MM-DD` strings (`server/db.mjs`); never convert them
  through `Date` on the server, or a note will move a day in another timezone.

## Identity and administration

- Display names are the user-facing identity: real names, unique case-insensitively via
  `users_display_name_unique`. Registration requires one; invites accept a name or a 6-digit ID.
  A member can change their own display name; the six-digit ID remains fixed.
- `/admin` is a separate lazy-loaded surface (`src/admin/`), mounted by `main.tsx` outside the day
  shell. Never move admin controls into the notebook.
- Two tiers: the owner (`is_super_admin`) can promote/demote administrators; an administrator
  (`is_admin`) can change a member's ID but not another administrator's. Nobody changes their own
  ID, and the owner cannot be demoted. Enforce this server-side, not only in the UI.
- User-ID changes rely on `ON UPDATE CASCADE`; the target's existing sessions become invalid. Keep
  the console warning accurate if that behavior changes.
- Migrations are append-only. `002_names_and_admins.sql` adds the name index and tiers;
  `003_note_shares.sql` adds per-note access; `004_public_note_links.sql` adds revocable
  anonymous read-only links.
- Workspace access and note access are different. `note_shares` grants one note only; a note
  sharee must never gain workspace presence, siblings, pinning, moving, deletion or invite rights.
  Keep the room switch (`private-` → `shared-`) and the sharee tray in sync if this changes.
- A public link is a separate, narrower capability: one random token, an unauthenticated read-only
  GET, and no collaboration room. Only note managers can create or revoke it. The public response
  must never include user IDs, workspace IDs, share lists, pin state, or an edit path.
- Workspace switching, members and invites belong in the Workspace sheet, not Account.

## Design rules

- `DESIGN.md` is the design system. Read it before changing UI and cite the rule the change serves.
- **Mobile is the design target**: build and check at 390×844 first; anything only complete at
  desktop width is unfinished.
- The app is one view: a day, its notes, and the Global pins tray. No note page, no feed, no search page.
  Notes open as a full-screen editor on phones and fill only the centre column on desktop; settings,
  calendar, workspace, sharing and templates are sheets over the day. The rail scrolls horizontally
  only; the Calendar sheet reaches dates outside its window.
- Note rows do not repeat that they are notes. Only a day pin gets a marker.
- The page is paper: 1px hairlines, native fonts, flat ink. No card containers, gradients, glow,
  drop shadows, emoji or badge soup (`DESIGN.md` UI-01…UI-08). Use only the bespoke 16px stroke
  family in `src/components/Icon.tsx`; pair icons with labels except conventional controls with
  accessible names.
- Every capability has a tap-reachable control. Phone keyboards have no Tab, so list indentation has
  Outdent/Indent buttons beside the swipe gesture, and pinning has three visible choices.
- Never use browser primitives for product UI: no `window.confirm`/`alert`/`prompt`, `<select>`,
  `<dialog>`, native validation bubbles, or `title` as the only carrier of information. Inline
  two-tap confirmation and the existing sheet components are the pattern.
- Editing is local-first: text goes into the Yjs document and IndexedDB before the network. Do not
  add a save button, a debounce that blocks typing, or polling for freshness.
- Pinning is a two-mode contract (`DESIGN.md` UX-12): `global` leaves the day entirely and lives in
  the tray; `day` keeps the date and takes rank zero; `none` is ordinary. Never invent a third
  meaning for the pin control.

## Pushing

- Target: `git push origin HEAD:main` (remote `https://github.com/dctaneyo/Daystream.git`).
- If history diverges, do not force-push without confirming with the user.
- Generated icons (`public/icons/*.png`) stay gitignored and are recreated by `prebuild`.
