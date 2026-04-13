-- Mevcut veritabanında revizyon sütunu varsayılanını 0 yapmak için (Prisma şeması ile uyum).
-- Yalnızca elle SQL çalıştıran ortamlar için; `pnpm prisma db push` şemayı günceller.

ALTER TABLE "company_manuals" ALTER COLUMN "revision" SET DEFAULT 0;
ALTER TABLE "department_forms" ALTER COLUMN "revision" SET DEFAULT 0;
