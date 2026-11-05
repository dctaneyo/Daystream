-- Daystream — read-only public note links.
--
-- A public link exposes exactly one note's rendered document and date metadata
-- to anyone who has the unguessable token. It never grants workspace presence,
-- editing, sharing, pinning or the note's identity to the public page. Links
-- are one per note and are revoked by deleting the row.

CREATE TABLE note_public_links (
  note_id    UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  created_by VARCHAR(6) REFERENCES users(user_id)
               ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_note_public_links_token ON note_public_links(token);
