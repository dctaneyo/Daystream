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

## Pushing

- Target: `git push origin HEAD:main` (the remote is `https://github.com/dctaneyo/Daystream.git`).
- The sandbox needs credentials for that: a fine-grained PAT with **Contents: read & write** stored
  as a project secret named `GITHUB_TOKEN`. Use a one-off credential helper and never echo the value.
- History is reconciled: `main` was force-pushed from this branch, so `origin/main` now shares this
  history and `package-lock.json` is tracked again. If it ever diverges, `--force-with-lease` is the
  intended repair — but confirm with the user first, because it rewrites the branch.
- Generated icons (`public/icons/*.png`) stay gitignored and are recreated by `prebuild`.
