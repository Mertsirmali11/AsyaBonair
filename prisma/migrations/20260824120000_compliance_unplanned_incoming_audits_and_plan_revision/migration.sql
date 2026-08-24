-- Compliance Monitoring: Unplanned Audits, Incoming Audits, Audit Plan Revision.
-- Fully additive — no existing column/table/row is altered destructively, no data is
-- migrated/converted. Existing audit_plan_entries rows behave identically after this
-- migration (audit_type defaults to 'PLANNED', auditing_body_type_id stays NULL, and
-- audit_category_types.scopes defaults to {PLANNED} so today's categories keep showing up
-- exactly where they do today).
-- Hand-written idempotent SQL (ADD COLUMN/CREATE ... IF NOT EXISTS, DO $$ ... duplicate_object
-- guard for constraints) per the pattern in 20260813120000_finding_softdelete_auditee_checklist_submissions
-- and 20260815150000_user_groups — this project's migrations history table has pre-existing
-- drift, so this file is meant to be applied directly (`prisma db execute --file`), not via
-- `prisma migrate deploy`.

-- 1) AuditingBodyType — dış otorite/kuruluş listesi (Incoming Audit için), Audit Settings'ten yönetilir
CREATE TABLE IF NOT EXISTS "auditing_body_types" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "auditing_body_types_sort_order_idx" ON "auditing_body_types"("sort_order");
CREATE INDEX IF NOT EXISTS "auditing_body_types_is_active_idx" ON "auditing_body_types"("is_active");

-- 2) audit_plan_entries: audit_type (PLANNED/UNPLANNED/INCOMING) + auditing_body_type_id (Incoming only)
ALTER TABLE "audit_plan_entries" ADD COLUMN IF NOT EXISTS "audit_type" VARCHAR(20) NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "audit_plan_entries" ADD COLUMN IF NOT EXISTS "auditing_body_type_id" INTEGER;
CREATE INDEX IF NOT EXISTS "audit_plan_entries_audit_type_idx" ON "audit_plan_entries"("audit_type");
CREATE INDEX IF NOT EXISTS "audit_plan_entries_auditing_body_type_id_idx" ON "audit_plan_entries"("auditing_body_type_id");
DO $$ BEGIN
  ALTER TABLE "audit_plan_entries" ADD CONSTRAINT "audit_plan_entries_auditing_body_type_id_fkey"
    FOREIGN KEY ("auditing_body_type_id") REFERENCES "auditing_body_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) audit_category_types.scopes — hangi denetim türü/türlerinde (Planned/Unplanned/Incoming)
-- bu kategori seçilebilir. Mevcut kategoriler {PLANNED} ile doldurulur — bugünkü davranış
-- (yalnızca Audit Plan formunda görünür) birebir korunur.
ALTER TABLE "audit_category_types" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY['PLANNED']::TEXT[];

-- 4) AuditPlanRevision — yıllık Audit Plan'ın TAMAMININ değişiklik geçmişi (audit-log, snapshot
-- DEĞİL). Hiçbir audit_plan_entries satırını kopyalamaz/değiştirmez.
CREATE TABLE IF NOT EXISTS "audit_plan_revisions" (
  "id" SERIAL PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "revision_number" INTEGER NOT NULL,
  "revision_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_plan_revisions_year_revision_number_key" ON "audit_plan_revisions"("year", "revision_number");
CREATE INDEX IF NOT EXISTS "audit_plan_revisions_year_idx" ON "audit_plan_revisions"("year");
DO $$ BEGIN
  ALTER TABLE "audit_plan_revisions" ADD CONSTRAINT "audit_plan_revisions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "calisanlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) AuditPlanRevisionFile — bir revizyona eklenen dosya(lar) (onaylı plan PDF'i vb.)
CREATE TABLE IF NOT EXISTS "audit_plan_revision_files" (
  "id" SERIAL PRIMARY KEY,
  "audit_plan_revision_id" INTEGER NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "storage_path" VARCHAR(1000) NOT NULL,
  "mime_type" VARCHAR(200),
  "file_size_bytes" INTEGER,
  "uploaded_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "audit_plan_revision_files_audit_plan_revision_id_idx" ON "audit_plan_revision_files"("audit_plan_revision_id");
DO $$ BEGIN
  ALTER TABLE "audit_plan_revision_files" ADD CONSTRAINT "audit_plan_revision_files_audit_plan_revision_id_fkey"
    FOREIGN KEY ("audit_plan_revision_id") REFERENCES "audit_plan_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "audit_plan_revision_files" ADD CONSTRAINT "audit_plan_revision_files_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "calisanlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
