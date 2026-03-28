-- Doğum günü sorgusu: EXTRACT(MONTH/DAY) ile indeks desteği (Prisma şemasında ifade indeksi yok).
CREATE INDEX IF NOT EXISTS idx_calisanlar_birthday_month_day
ON calisanlar (
  (EXTRACT(MONTH FROM dogum_tarihi::date)),
  (EXTRACT(DAY FROM dogum_tarihi::date))
)
WHERE dogum_tarihi IS NOT NULL;
