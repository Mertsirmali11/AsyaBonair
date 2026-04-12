-- Orijinal departman formu dosyası (Supabase path + MIME) — Aç / yeni sekme
-- prisma db push ile uygulanmış olabilir; el ile çalıştırıyorsanız:

ALTER TABLE department_forms
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(280),
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(120);

ALTER TABLE department_forms
  ADD COLUMN IF NOT EXISTS form_number VARCHAR(80) NOT NULL DEFAULT '';
