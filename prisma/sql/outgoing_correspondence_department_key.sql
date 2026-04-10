-- Giden yazışma departman anahtarı (lib/outgoing-correspondence-departments.ts ile uyumlu).
ALTER TABLE "outgoing_correspondences"
  ADD COLUMN IF NOT EXISTS "department_key" VARCHAR(40);
CREATE INDEX IF NOT EXISTS "outgoing_correspondences_department_key_idx"
  ON "outgoing_correspondences" ("department_key");
