-- ============================================================
-- AsyaBonair — pgvector / manual_chunks migration
-- Supabase SQL Editor'da çalıştır (sıraya göre).
-- ============================================================

-- 1. pgvector extension'ı etkinleştir
--    (Supabase'de çoğu projede zaten aktif; hata verirse geçebilirsin)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. manual_chunks tablosunu oluştur
--    company_manuals.id referansı CASCADE ile bağlı
CREATE TABLE IF NOT EXISTS manual_chunks (
  id          SERIAL PRIMARY KEY,
  manual_id   INTEGER      NOT NULL
                REFERENCES company_manuals(id) ON DELETE CASCADE,
  chunk_index INTEGER      NOT NULL,
  chunk_text  TEXT         NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. manuel bazında arama için B-tree index
CREATE INDEX IF NOT EXISTS manual_chunks_manual_id_idx
  ON manual_chunks (manual_id);

-- 4. Cosine similarity için IVFFlat index
--    NOT: index oluşturulabilmesi için tabloda en az 1 satır olmalı.
--    Chunk'ları indexledikten SONRA aşağıdaki komutu tekrar çalıştır.
--    lists = 100, ~10.000 satıra kadar verimli; daha fazlası için artır.
CREATE INDEX IF NOT EXISTS manual_chunks_embedding_ivfflat_idx
  ON manual_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- Kontrol sorgusu — tabloyu ve index'leri doğrula
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'manual_chunks';
