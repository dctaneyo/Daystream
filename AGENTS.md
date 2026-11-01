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
- If a change needs a rule that isn't written down, add the rule to `DESIGN.md` in the same commit.

## Pushing

- Target: `git push origin HEAD:main` (the remote is `https://github.com/dctaneyo/Daystream.git`).
- The sandbox needs credentials for that: a fine-grained PAT with **Contents: read & write** stored
  as a project secret named `GITHUB_TOKEN`. Use a one-off credential helper and never echo the value.
- History is reconciled: `main` was force-pushed from this branch, so `origin/main` now shares this
  history and `package-lock.json` is tracked again. If it ever diverges, `--force-with-lease` is the
  intended repair — but confirm with the user first, because it rewrites the branch.
- Generated icons (`public/icons/*.png`) stay gitignored and are recreated by `prebuild`.
