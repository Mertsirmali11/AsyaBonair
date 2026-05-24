-- meetings tablosuna şablon alanlarını ekle
-- Supabase SQL Editor'da çalıştır

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meeting_time  VARCHAR(10),   -- HH:MM
  ADD COLUMN IF NOT EXISTS location      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS compiled_by   VARCHAR(200);
