-- Şirket manueli: departman, seri kimliği ve revizyon (mevcut satırlar için seri otomatik).
-- Prisma: `pnpm prisma db push` bu şemayı senkronlar; yalnızca SQL kullanıyorsanız bu dosyayı çalıştırın.

ALTER TABLE "company_manuals" ADD COLUMN IF NOT EXISTS "department" VARCHAR(100);
ALTER TABLE "company_manuals" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "company_manuals" ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN NOT NULL DEFAULT true;

-- Dolu tabloda NOT NULL seri: önce sütun + varsayılan, sonra gerekirse NOT NULL
ALTER TABLE "company_manuals" ADD COLUMN IF NOT EXISTS "series_id" VARCHAR(36)
  DEFAULT (gen_random_uuid()::text);
UPDATE "company_manuals" SET "series_id" = gen_random_uuid()::text WHERE "series_id" IS NULL;
ALTER TABLE "company_manuals" ALTER COLUMN "series_id" SET NOT NULL;
ALTER TABLE "company_manuals" ALTER COLUMN "series_id" SET DEFAULT (gen_random_uuid()::text);

CREATE INDEX IF NOT EXISTS "company_manuals_series_id_idx" ON "company_manuals" ("series_id");
CREATE INDEX IF NOT EXISTS "company_manuals_is_current_idx" ON "company_manuals" ("is_current");

CREATE UNIQUE INDEX IF NOT EXISTS "company_manuals_series_revision_uniq"
  ON "company_manuals" ("series_id", "revision");
