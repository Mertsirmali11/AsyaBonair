-- Çalışan konum geçmişi tablosu
CREATE TABLE IF NOT EXISTS company_status_logs (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id  INT         NOT NULL REFERENCES calisanlar(id) ON DELETE CASCADE,
  work_location VARCHAR(50) NOT NULL DEFAULT 'Office',
  status_date  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_status_logs_emp_date
  ON company_status_logs (employee_id, status_date DESC);

CREATE INDEX IF NOT EXISTS idx_company_status_logs_date
  ON company_status_logs (status_date DESC);

-- Mevcut çalışanların bugünkü konumunu başlangıç kaydı olarak ekle
-- (Daha önce log yoksa bugün için baz çizgisi oluşturur)
INSERT INTO company_status_logs (employee_id, work_location, status_date)
SELECT id,
       COALESCE(work_location, 'Office'),
       CURRENT_DATE
FROM   calisanlar
WHERE  isten_cikis_tarihi IS NULL
ON CONFLICT DO NOTHING;
