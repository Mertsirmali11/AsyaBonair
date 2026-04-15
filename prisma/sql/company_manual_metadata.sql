-- Manual number and user-defined revision date for company manuals
ALTER TABLE "company_manuals"
  ADD COLUMN IF NOT EXISTS "manual_no" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "revision_date" DATE;
