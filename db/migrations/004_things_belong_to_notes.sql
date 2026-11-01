-- 004: a Thing lives in a Note. The Note is the home; the day stays a stamp.
--
-- Everything already written lands in its workspace's Inbox, so no Thing is
-- ever homeless and nothing written in a day or the backlog is lost when those
-- lanes stop being containers. Re-running this file is safe.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_inbox boolean NOT NULL DEFAULT false;

-- Exactly one Inbox per workspace, enforced by the database rather than trust.
CREATE UNIQUE INDEX IF NOT EXISTS notes_one_inbox_per_workspace
  ON notes (workspace_id) WHERE is_inbox;

ALTER TABLE things ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES notes(id) ON DELETE CASCADE;

-- The Inbox exists before the backfill depends on it.
INSERT INTO notes (workspace_id, title, created_by, is_inbox)
SELECT w.id, 'Inbox', w.owner_id, true
  FROM workspaces w
 WHERE NOT EXISTS (
   SELECT 1 FROM notes n WHERE n.workspace_id = w.id AND n.is_inbox
 );

UPDATE things t
   SET note_id = n.id
  FROM notes n
 WHERE n.workspace_id = t.workspace_id
   AND n.is_inbox
   AND t.note_id IS NULL;

ALTER TABLE things ALTER COLUMN note_id SET NOT NULL;

-- The per-Note read path: one Note's Things, in order.
CREATE INDEX IF NOT EXISTS things_note_idx ON things (note_id, sort_order);
