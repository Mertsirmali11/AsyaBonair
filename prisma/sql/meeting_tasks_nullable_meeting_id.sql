-- Optional meeting for standalone tasks (e.g. risk-board barriers).
-- Run against your Postgres DB if not using `prisma migrate`.

ALTER TABLE "meeting_tasks" DROP CONSTRAINT IF EXISTS "meeting_tasks_meeting_id_fkey";
ALTER TABLE "meeting_tasks" ALTER COLUMN "meeting_id" DROP NOT NULL;
ALTER TABLE "meeting_tasks" ADD CONSTRAINT "meeting_tasks_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
