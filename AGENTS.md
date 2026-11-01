# Project instructions

## Ship every change

- After any code change, **commit and push to `main`** so Railway redeploys immediately. Do not
  leave finished work uncommitted.
- Verify before pushing: `npx tsc --noEmit` and `npm run build`. When auth, data or realtime code
  changed, also run `node scripts/smoke.mjs` against a running server.
- Keep commit messages descriptive of the intent, not a file list.

## Secrets

- Never commit secrets. `.env`, `.env.local`, `.runtime/` and `.pgdata/` are gitignored.
- Production config lives in Railway service variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`,
  `AUTH_TRUST_HOST`, optional `APP_TIMEZONE`).

## Stack notes

- Single Railway service: `server/index.mjs` hosts Next and the Hocuspocus WebSocket at `/collab`.
  Migrations run at boot; do not add a separate release step.
- Do not enable `output: "standalone"` — it conflicts with the custom server.
- `db/migrations/*.sql` are append-only; add a new numbered file instead of editing an applied one.

## Design rules

- `DESIGN.md` is the design system: `UX-nn` rules (behaviour) outrank `UI-nn` rules (appearance)
  when they conflict. Read it before changing any UI, and cite the rule your change serves.
- The model is Workspace → Note → Thing: a Thing lives in exactly one Note and carries a day, so a
  new lane a Thing can be typed into is a design change, not a feature.
- **Mobile is the design target**, not the shrunk case (~95% of use is one thumb on a phone): build
  and check a screen at 390×844 before widening it, and treat anything only complete at `lg` as
  unfinished.
- Every capability needs a tap-reachable control, not just a shortcut: phone keyboards have no
  `Ctrl`/`Cmd`/`Alt`/`Option`/arrows and no usable `Shift`. Ship the on-screen twin with the shortcut
  (`DESIGN.md` UX-31/UX-32, table in §5.5).
- **Bespoke over templated.** Generated-app tells are banned by `DESIGN.md` §8 `VI-01…VI-12`:
  gradients, glass cards, emoji, an icon per label, badge soup, sparkle affordances. Every screen
  names its signature element and passes the cover test (`VI-10`) with the brand hidden at 390×844.
- New fonts, icon sets, animation libraries or component kits are design decisions, not conveniences:
  they need a rule in `DESIGN.md` and a UX rule served, in the same change (`VI-07`).
- The app is **one date-dependent view**: `/app/<day>` lists the Notes belonging to that day, and a
  Note is opened to read or write its Things (`DESIGN.md` UX-23). Do not reintroduce a feed, backlog
  or Notes-index destination, and never add a way to create a Thing outside a Note (`UX-33`).
- Deploys change the code under open tabs: keep the build identity honest (`/api/version`, the
  `daystream-build` meta tag) and never let an update reload in a loop (`DESIGN.md` UX-34).
- Never use browser primitives for product UI: no `window.confirm`/`alert`/`prompt`, `<select>`,
  `<dialog>`, native validation bubbles, or `title` tooltips as the only carrier of information.
  Build or reuse the components in `src/components` instead (`DESIGN.md` UI-13).
- If a change needs a rule that isn't written down, add the rule to `DESIGN.md` in the same commit.

## Pushing

- Target: `git push origin HEAD:main` (the remote is `https://github.com/dctaneyo/Daystream.git`).
- The sandbox needs credentials for that: a fine-grained PAT with **Contents: read & write** stored
  as a project secret named `GITHUB_TOKEN`. Use a one-off credential helper and never echo the value.
- History is reconciled: `main` was force-pushed from this branch, so `origin/main` now shares this
  history and `package-lock.json` is tracked again. If it ever diverges, `--force-with-lease` is the
  intended repair — but confirm with the user first, because it rewrites the branch.
- Generated icons (`public/icons/*.png`) stay gitignored and are recreated by `prebuild`.
