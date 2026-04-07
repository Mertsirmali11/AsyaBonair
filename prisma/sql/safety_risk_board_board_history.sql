-- Bow-tie board history (JSON array) — run if not using `prisma db push`.
ALTER TABLE "safety_risk_boards"
  ADD COLUMN IF NOT EXISTS "board_history" JSONB NOT NULL DEFAULT '[]'::jsonb;
