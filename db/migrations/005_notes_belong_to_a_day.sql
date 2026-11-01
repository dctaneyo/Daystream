-- 005: a Note belongs to a day.
--
-- The app has one view: a day, listing its Notes. So a Note needs a day of its
-- own rather than being discovered through the Things inside it. Existing
-- Notes take the day they were created; the column then stops accepting nulls.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS day date;

UPDATE notes
   SET day = COALESCE(created_at::date, CURRENT_DATE)
 WHERE day IS NULL;

ALTER TABLE notes ALTER COLUMN day SET DEFAULT CURRENT_DATE;
ALTER TABLE notes ALTER COLUMN day SET NOT NULL;

CREATE INDEX IF NOT EXISTS notes_day_idx ON notes (workspace_id, day);
