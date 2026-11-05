-- Daystream — real-name identities and two admin tiers.
--
-- Display names are unique case-insensitively because a workspace invite can
-- name a person instead of quoting a six-digit ID. Accounts that predate this
-- migration receive a unique placeholder and can still be found by ID.

ALTER TABLE users ADD COLUMN display_name VARCHAR(60);

UPDATE users
   SET display_name = 'Member ' || user_id
 WHERE display_name IS NULL;

ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

CREATE UNIQUE INDEX users_display_name_unique
  ON users (lower(display_name));

ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- The first administrator owns the install. Only the owner can make or remove
-- other administrators; administrators can still manage ordinary members.
UPDATE users
   SET is_super_admin = TRUE
 WHERE user_id = (
   SELECT user_id
     FROM users
    WHERE is_admin
    ORDER BY created_at ASC, user_id ASC
    LIMIT 1
 );

ALTER TABLE users
  ADD CONSTRAINT users_super_admin_is_admin
  CHECK (NOT is_super_admin OR is_admin);

-- A six-digit ID is mutable by an administrator. Cascading the update keeps
-- memberships, note ownership and template authorship attached to the person.
ALTER TABLE workspace_members
  DROP CONSTRAINT workspace_members_user_id_fkey,
  ADD CONSTRAINT workspace_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE notes
  DROP CONSTRAINT notes_user_id_fkey,
  ADD CONSTRAINT notes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE templates
  DROP CONSTRAINT templates_created_by_fkey,
  ADD CONSTRAINT templates_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;
