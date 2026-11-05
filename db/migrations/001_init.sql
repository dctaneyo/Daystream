-- Daystream — clean-slate schema.
--
-- Daystream was rebuilt from scratch on the date-anchored notes specification,
-- so this migration replaces the previous product's tables outright. It runs
-- once per database (tracked in _daystream_migrations).

DROP TABLE IF EXISTS
  things,
  yjs_documents,
  note_members,
  admin_audit_log,
  sessions,
  accounts,
  verification_tokens,
  workspace_members,
  notes,
  templates,
  workspaces,
  users
CASCADE;

CREATE TABLE users (
  user_id    VARCHAR(6) PRIMARY KEY, -- randomized distinct 6-digit identification token
  pin_hash   VARCHAR(255) NOT NULL,  -- bcrypt hash of the 6-digit PIN
  is_admin   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      VARCHAR(6) REFERENCES users(user_id) ON DELETE CASCADE,
  role         VARCHAR(50) DEFAULT 'editor', -- admin, editor, viewer
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(255) NOT NULL,
  structure  JSONB NOT NULL, -- modular structured layout representation
  created_by VARCHAR(6) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(6) REFERENCES users(user_id) ON DELETE SET NULL,
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  content       BYTEA, -- Yjs CRDT binary state (delta log updates)
  assigned_date DATE NOT NULL,
  sort_order    REAL NOT NULL DEFAULT 0.0,
  pin_mode      VARCHAR(10) DEFAULT 'none', -- none | global | day
  template_id   UUID REFERENCES templates(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- List projections, rewritten when the CRDT document is stored. Keeping them
  -- here means the day and the held tray are one indexed query, not a decode of
  -- every note's binary state.
  title         VARCHAR(255) NOT NULL DEFAULT '',
  excerpt       TEXT NOT NULL DEFAULT '',
  CONSTRAINT notes_pin_mode_valid CHECK (pin_mode IN ('none', 'global', 'day'))
);

CREATE INDEX idx_notes_assigned_date ON notes(assigned_date);
CREATE INDEX idx_notes_workspace ON notes(workspace_id);
CREATE INDEX idx_notes_day_order ON notes(workspace_id, assigned_date, sort_order);
CREATE INDEX idx_notes_global_pins ON notes(workspace_id, sort_order) WHERE pin_mode = 'global';
CREATE INDEX idx_notes_owner ON notes(user_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

CREATE OR REPLACE FUNCTION daystream_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_touch_updated_at
BEFORE UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION daystream_touch_updated_at();

-- Three starter layouts. `created_by` stays NULL so everyone can use them, and
-- editing one creates an ordinary note rather than mutating the template.
INSERT INTO templates (title, structure) VALUES
(
  'Daily page',
  '{"blocks":[
    {"type":"h1","text":"Daily page"},
    {"type":"p","text":""},
    {"type":"h2","text":"Today"},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"h2","text":"What happened"},
    {"type":"p","text":""},
    {"type":"h2","text":"Tomorrow"},
    {"type":"bullet","text":""}
  ]}'::jsonb
),
(
  'Meeting',
  '{"blocks":[
    {"type":"h1","text":"Meeting"},
    {"type":"p","text":""},
    {"type":"h2","text":"Attendees"},
    {"type":"p","text":""},
    {"type":"h2","text":"Agenda"},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"h2","text":"Decisions"},
    {"type":"p","text":""},
    {"type":"h2","text":"Follow-ups"},
    {"type":"check","text":""},
    {"type":"check","text":""}
  ]}'::jsonb
),
(
  'Weekly review',
  '{"blocks":[
    {"type":"h1","text":"Weekly review"},
    {"type":"h2","text":"Moved"},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"h2","text":"Stalled"},
    {"type":"bullet","text":""},
    {"type":"bullet","text":""},
    {"type":"h2","text":"Next week"},
    {"type":"p","text":""},
    {"type":"quote","text":""}
  ]}'::jsonb
);
