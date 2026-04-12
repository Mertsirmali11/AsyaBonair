-- Destek talebi ekleri (görsel + PDF); Prisma migrate ile de uygulanabilir.
CREATE TABLE IF NOT EXISTS "support_ticket_attachments" (
    "id" SERIAL NOT NULL,
    "support_ticket_id" INTEGER NOT NULL,
    "storage_path" VARCHAR(1000) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(200) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_ticket_attachments_support_ticket_id_idx" ON "support_ticket_attachments"("support_ticket_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_ticket_attachments_support_ticket_id_fkey'
  ) THEN
    ALTER TABLE "support_ticket_attachments"
      ADD CONSTRAINT "support_ticket_attachments_support_ticket_id_fkey"
      FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
