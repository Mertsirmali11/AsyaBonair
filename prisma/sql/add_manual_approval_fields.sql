-- Manual onay akışı için alanlar
-- Supabase SQL Editor'da çalıştır

ALTER TABLE company_manuals
  ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Mevcut kayıtlar zaten approved sayılır (DEFAULT 'approved' ile otomatik)
