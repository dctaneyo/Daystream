# Daystream

A local-first, calendar-anchored daily notebook. Every note is a **Thing** — a small block
attached to a specific day — and multiple people can edit the same day at the same time.

Built to run as a **single service on Railway**: Next.js and the realtime sync server share one
process and one port, with Postgres as the only other piece of infrastructure.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 (CSS-first `@theme` tokens, dark UI) |
| Database | Postgres (Railway plugin) accessed with `pg` + plain SQL migrations |
| Auth | Auth.js v5 (`next-auth@beta`) — 6-digit ID + 6-digit PIN, bcrypt, lockout, JWT sessions |
| Realtime | Yjs CRDTs over Hocuspocus 4, WebSocket at `/collab` |
| Offline | `y-indexeddb` (per-day Y.Doc cache) + service worker app shell |
| PWA | `manifest.webmanifest` + hand-written `public/sw.js` (no build plugin) |
| Hosting | Railway — one Nixpacks service, `railway.json` in the repo root |

No external SaaS: no Supabase, no Liveblocks, no PartyKit, no Vercel. Everything above runs in
your Railway project or in the user's browser.

---

## Architecture

```
                 ┌──────────── one Railway service ────────────┐
                 │                                             │
  HTTPS ────────▶│  server/index.mjs                           │
  WSS /collab ──▶│   ├─ Next.js request handler                │
                 │   └─ Hocuspocus (Yjs sync + presence)        │
                 │            │                                 │
                 │            ▼                                 │
                 │      Postgres (Railway plugin)               │
                 │        · yjs_documents  (CRDT binary state)  │
                 │        · things         (SQL projection)     │
                 │        · users / workspaces / members        │
                 └─────────────────────────────────────────────┘
```

**Why a projection?** The Yjs document is the source of truth for a day, so concurrent edits
never clobber each other. But CRDT blobs are useless for SQL questions ("which days have notes?",
"find 'conveyor'"), so `onStoreDocument` rewrites the `things` rows for that room. Calendar
heat-maps, search and the 7-day roll-up are therefore plain indexed SQL.

**Room naming** is the unit of sync and persistence:

```
<workspaceId>:2026-10-30   one day
<workspaceId>:backlog      undated items parked for later
note:<noteId>              a standalone note holding any number of Things
```

Notes are their own room so they can be shared one at a time: `note_members` grants access to a
single note without exposing the owner's days, backlog or other notes. A collab token names the
exact room it was minted for, so a token can never be replayed against a sibling note.

**Auth on the socket**: the browser calls `GET /api/collab-token?room=…`, which checks the
session *and* workspace membership, then mints a short-lived HS256 JWT. Hocuspocus verifies that
JWT in `onAuthenticate` and re-checks membership before a document loads. The client never
chooses which workspace it can join.

**Block model**: an ordered `Y.Array` of `Y.Map` entries (`blocks`), so ordering and structure
merge conflict-free. Block *content* is currently a plain string field — two people typing in the
same block resolves last-writer-wins per field. Swapping `content` to a `Y.Text` is the upgrade
path for character-level merging (see Roadmap).

---

## Signing in

There is no email or password. Every account has a **6-digit Daystream ID** and a
**6-digit PIN**, designed for one-handed entry on a phone:

- `/login` is a two-step numpad: six digits for the ID, six masked digits for the PIN, auto-submit.
  A hardware keyboard also works on desktop.
- Five wrong PINs lock the account for 5 minutes (`users.failed_attempts` / `locked_until`).
- Unknown IDs are compared against a dummy bcrypt hash so they cost the same as a wrong PIN.
- The first account created on an empty install becomes an admin; admins issue (or reset) everyone
  else's ID/PIN from the console.
- `npm run seed:dev` creates `100001 / 123456` (admin) and `100002 / 654321` (member).

## Admin console

The console lives at `/admin` — a **separate route tree with its own layout**, so admins use the
normal app at `/app` without admin chrome around their notes. Sidebar access appears only for
admins; non-admins are redirected to `/app`.

- **Overview** — accounts, admins, suspended users, workspaces, Things, documents, plus recent
  accounts and admin activity.
- **Users** — search by ID/name/email, create accounts (random 6-digit ID or one you choose,
  optional or generated PIN, one-time display), **change an existing user's ID**, reset PIN,
  suspend/activate, grant/revoke admin, delete.
- **Audit log** — every admin action with actor, target and JSON details, including ID changes.

There is deliberately no workspace management here: a workspace has exactly one member, so
"administering" one would just mean reaching into somebody's private data.

Guard rails: you cannot suspend, demote or delete yourself, and the last active admin cannot be
removed. All actions are logged to `admin_audit_log`.

## Keyboard & formatting (iOS / Android)

The app deliberately **uses the native on-screen keyboard** rather than shipping a fake one:

- A web app cannot suppress the iOS keyboard without giving up the caret, selection, dictation,
  autocorrect, emoji, paste, IME input and VoiceOver. A hand-rolled keyboard would be strictly
  worse than the one people already use.
- What actually breaks on phones is *layout* and *formatting*, so those are what Daystream fixes:
  - `KeyboardInset` writes the real keyboard height from `visualViewport` into `--keyboard-inset`,
    and the composer offsets itself by that amount. Android gets `interactive-widget=resizes-content`
    as well. iOS Safari does not resize the layout viewport, which is why the JS inset exists.
  - All inputs are >= 16px, so iOS never zooms on focus; `field-sizing: content` autosizes the
    textarea, capped at 40dvh with its own scroll.
  - Safe-area insets, `scroll-padding-bottom` on the stream, and `overscroll-behavior: contain`
    keep content reachable instead of hidden behind the keyboard.
  - A “Format text” accessory bar sits inside the composer, like a native input assistant:
    **Task**, **B**, *I*, ~~S~~, `</>`, • and `[[ ]]`. `onPointerDown` preventDefault keeps focus, so
    tapping a format button does not collapse the keyboard.
  - Blocks render a read-only inline-markdown view (`**bold**`, `*italic*`, `~~strike~~`, `` `code` ``,
    `[[wikilink]]`) and switch to the textarea on tap, so formatting is visible without a rich-text
    editor fighting the keyboard.
  - The PIN screen keeps its **custom numpad** on purpose: numeric entry is exactly where a custom
    pad beats the system keyboard (no autocorrect, no shift, bigger tap targets, auto-submit).

## Theming (light / dark / system)

Theme defaults to the **device preference** and can be overridden per device from the toggle in the
sidebar, the landing page, or Settings → Appearance.

- `@custom-variant dark` makes `dark:` class-based instead of media-query-based, so an override is possible.
- All colours are CSS variables (`--canvas`, `--panel`, `--raised`, `--edge`, `--ink`, `--muted`,
  `--accent`, `--accent-ink`) with a light set on `:root` and a dark set on `.dark`, mapped into
  Tailwind via `@theme inline`. Components only use tokens (`bg-panel`, `text-muted`, …).
- The choice is stored in `localStorage` under `daystream-theme` and applied by an inline script in
  `<body>` **before first paint**, so there is no flash of the wrong theme. The script also updates
  `<meta name="theme-color">`, and `color-scheme` is set so native form controls and scrollbars match.
- With no stored choice it follows the device live (`matchMedia` change listener).

## What works today

- 6-digit ID + PIN accounts with numpad login, PIN change in Settings, and lockout protection.
- Light/dark theming that follows the device by default, with a per-device override.
- Keyboard-aware composer with a formatting accessory bar and inline-markdown block rendering.
- Workspaces: switch from the sidebar, create more in Settings, one cookie-scoped active workspace.
- Daily canvas at `/app/YYYY-MM-DD`: add Things, edit inline, toggle todos, convert note ⇄ task,
  delete, move to tomorrow, move to backlog.
- Day navigation (prev/next/Today) plus horizontal swipe on touch devices.
- Calendar sidebar with per-day activity heat dots and month paging.
- Backlog canvas at `/app/backlog` for undated items, plus a sidebar scratchpad on the day view
  that writes into the same backlog room instead of just linking to it.
- Notes at `/app/notes`: standalone documents that hold any number of Things, shareable one note at
  a time by the other person's 6-digit ID.
- Search at `/app/search` (SQL `ILIKE` over the projection) and a 7-day open-task roll-up.
- Realtime: multi-tab/multi-device sync, presence avatars, remote carets drawn at each
  collaborator's character offset inside a Thing, and an honest status pill (Connected /
  Reconnecting… changes saved locally / Working offline).
- Offline: writes land in IndexedDB first, so the editor keeps working with no server.
- Installable PWA with standalone display, offline fallback page, and generated icons.

Not built yet: wikilinks/backlinks, reminders with notifications, attachments, calendar
integrations, per-block `Y.Text` merging. The schema and room model already leave room
for all of them.

---

## Local development

Requires Node 22+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local     # then set AUTH_SECRET + DATABASE_URL
```

There are two supported ways to get Postgres locally:

**A. PGlite (zero install, what the smoke test uses)**

```bash
# terminal 1 — in-process Postgres served over the wire protocol, data in ./.pgdata
npm run dev:db

# terminal 2
npm run db:migrate
npm run seed:dev   # optional: creates 100001 / 123456 (admin)
npm run dev
```

**B. Any real Postgres** (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17`),
then set `DATABASE_URL` and run `npm run db:migrate && npm run dev`.

`npm run dev` boots the custom server with Next in dev mode; the app is at
<http://localhost:3000> and the socket at `ws://localhost:3000/collab`.

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Railway: reference the Postgres plugin's private URL |
| `AUTH_SECRET` | yes | 32+ random bytes: `openssl rand -base64 32` |
| `AUTH_URL` | prod | Public origin, e.g. `https://daystream.up.railway.app` |
| `AUTH_TRUST_HOST` | prod | `true` behind Railway's proxy |
| `APP_TIMEZONE` | no | e.g. `America/New_York`; decides what "today" means |
| `PORT` | auto | Injected by Railway |
| `NEXT_PUBLIC_COLLAB_URL` | no | Only for split deployments; defaults to same-origin `/collab` |

`npm run seed:dev` is local-only and must not be run against production. It creates
`100001 / 123456` (admin) and `100002 / 654321` (member).

---

## Deploying to Railway

1. Create a project → **Deploy from GitHub repo** → pick this repo.
2. Add the **PostgreSQL** plugin to the same project.
3. On the Daystream service, set variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` = a fresh `openssl rand -base64 32`
   - `AUTH_URL` = `https://<your-domain>` and `AUTH_TRUST_HOST` = `true`
   - `APP_TIMEZONE` = your timezone (optional but recommended)
4. Deploy. `railway.json` sets:
   - build: `npm install && npm run build`
   - start: `npm run start` → `node server/index.mjs`
   - health check: `/api/health`
5. Generate a domain and open it. Migrations run automatically at boot (idempotent, tracked in
   `_daystream_migrations`), so there is no separate release step.

Notes specific to this setup:

- Railway routes a single public port per service. Next and Hocuspocus share it precisely so you
  don't need a second service (or a paid realtime provider).
- Do not enable `output: "standalone"` — it conflicts with the custom server.
- Sticky sessions/WSS are not needed: the socket runs in the same container as the page.

---

## Verification

```bash
npm run typecheck      # tsc --noEmit
npm run build          # production build
node scripts/smoke.mjs # end-to-end: auth, token, WS sync, projection, search
```

`scripts/smoke.mjs` needs a running server plus `DATABASE_URL` and `AUTH_SECRET`, and a seeded
account (`npm run seed:dev`). It checks 24 things, including that a foreign workspace is refused,
that a bad collab token is rejected, and that a token minted for one room cannot open another. `scripts/ws-debug.mjs <workspaceId> [date]` is a manual
realtime probe that logs every provider event.

---

## Layout

```
db/migrations/        SQL migrations (idempotent, applied at boot)
server/index.mjs      Node server: Next handler + WS upgrade at /collab
server/collab.mjs     Hocuspocus config: auth, load/store, SQL projection
server/migrate.mjs    Migration runner (also `npm run db:migrate`)
src/app/              App Router: landing, login/signup (numpad), /app/[date], backlog, notes, search
src/app/admin/        separate admin console (overview, users, audit)
src/components/       DailyCanvas (Yjs), BlockItem, PeerCaret, Scratchpad, CalendarPanel, …
src/lib/              db, blocks, rooms, notes, presence, date, activity, workspaces, collab-token
scripts/              dev-db (PGlite), seed-dev, smoke, ws-debug, gen-icons
public/               manifest, service worker, generated icons
```

## Roadmap

1. **Per-block `Y.Text`** so two people can type inside one Thing character-by-character.
2. **Wikilinks + backlinks** (`[[Project]]`), resolved during projection into a links table.
3. **Reminders** — needs a `things.reminder_at` column (it does not exist yet), notifications and a
   scheduler. Until then the `reminder` type behaves as a Task.
4. **Attachments** — R2/S3 bucket or Postgres large objects, with signed upload URLs.
5. **Team workspaces** — invites, roles (`workspace_members.role` already exists), shared day views.
6. **Signup policy** — a toggle/env flag so an admin can close public self-signup.
7. **Calendar integrations** — read-only Google/Outlook events rendered into the daily timeline.
