-- audit_sessions tablosuna yorum sütunları ekle
-- Supabase SQL Editor'da çalıştır

ALTER TABLE audit_sessions
  ADD COLUMN IF NOT EXISTS auditor_comment TEXT,
  ADD COLUMN IF NOT EXISTS auditee_comment TEXT;
