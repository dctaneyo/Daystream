-- PIN + numeric ID authentication, admin roles and an audit trail.
-- Existing email/password rows are migrated: each user gets a 6-digit public ID,
-- and the old email constraint is relaxed (email is now optional contact info).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_id       text,
  ADD COLUMN IF NOT EXISTS pin_hash        text,
  ADD COLUMN IF NOT EXISTS is_admin        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at   timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until    timestamptz,
  ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Backfill any pre-existing accounts with a 6-digit ID starting at 100001.
DO $$
DECLARE
  row RECORD;
  candidate integer := 100001;
BEGIN
  FOR row IN SELECT id FROM users WHERE public_id IS NULL ORDER BY created_at ASC LOOP
    WHILE EXISTS (SELECT 1 FROM users u WHERE u.public_id = candidate::text) LOOP
      candidate := candidate + 1;
    END LOOP;
    UPDATE users SET public_id = candidate::text WHERE id = row.id;
    candidate := candidate + 1;
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_key ON users (public_id);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log (created_at DESC);
