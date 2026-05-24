-- support_ticket_history tablosunu oluştur
-- Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS support_ticket_history (
  id              SERIAL PRIMARY KEY,
  support_ticket_id INTEGER NOT NULL
    REFERENCES support_tickets(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id        INTEGER NOT NULL
    REFERENCES calisanlar(id) ON DELETE RESTRICT,
  event_type      VARCHAR(40) NOT NULL,
  status_from     TEXT,
  status_to       TEXT,
  admin_note      TEXT,
  subject_snapshot VARCHAR(200),
  content_snapshot TEXT,
  attachment_meta JSONB
);

CREATE INDEX IF NOT EXISTS support_ticket_history_ticket_created_idx
  ON support_ticket_history(support_ticket_id, created_at);
