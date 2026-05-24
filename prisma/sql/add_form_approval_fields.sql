-- Form onay akışı için alanlar
-- Supabase SQL Editor'da çalıştır

ALTER TABLE department_forms
  ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Mevcut kayıtlar zaten approved sayılır (DEFAULT 'approved' ile otomatik)
