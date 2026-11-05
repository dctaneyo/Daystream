-- Daystream — per-note sharing.
--
-- Workspace membership grants access to every note in that workspace. A note
-- share grants access to exactly one note, for someone who is not a member of
-- its workspace. The two are additive; removing a share never touches the
-- workspace.

CREATE TABLE note_shares (
  note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id    VARCHAR(6) NOT NULL REFERENCES users(user_id)
               ON UPDATE CASCADE ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (note_id, user_id),
  CONSTRAINT note_shares_role_valid CHECK (role IN ('editor', 'viewer'))
);

CREATE INDEX idx_note_shares_user ON note_shares(user_id);
