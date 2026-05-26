-- Toplantı silinince bağlı görevler de silinsin (eskiden ON DELETE SET NULL idi).
ALTER TABLE meeting_tasks
  DROP CONSTRAINT IF EXISTS meeting_tasks_meeting_id_fkey;

ALTER TABLE meeting_tasks
  ADD CONSTRAINT meeting_tasks_meeting_id_fkey
  FOREIGN KEY (meeting_id)
  REFERENCES meetings(id)
  ON DELETE CASCADE;
