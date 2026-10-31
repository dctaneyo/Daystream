-- Standalone notes that can hold any number of Things, plus per-note sharing.
-- A note belongs to one workspace (its owner's), but a second account only gets
-- in through note_members — sharing is deliberately separate from workspace
-- membership so a shared note never exposes the owner's other notes or days.

CREATE TABLE IF NOT EXISTS notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_workspace_idx ON notes (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS note_members (
  note_id    uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, user_id)
);

CREATE INDEX IF NOT EXISTS note_members_user_idx ON note_members (user_id);
