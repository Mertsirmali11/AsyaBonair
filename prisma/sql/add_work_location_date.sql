-- Çalışanın konum durumu için tarih alanı (opsiyonel, görevde/saha vb. için)
ALTER TABLE calisanlar
  ADD COLUMN IF NOT EXISTS work_location_date DATE;
