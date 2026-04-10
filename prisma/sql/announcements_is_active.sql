-- Add active flag for announcements (dashboard lists only is_active = true).
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "announcements_is_active_idx" ON "announcements" ("is_active");
