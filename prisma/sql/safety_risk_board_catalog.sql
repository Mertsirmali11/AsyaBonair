-- Risk Board liste kalıcılığı (singleton satır id=1).
CREATE TABLE IF NOT EXISTS "safety_risk_board_catalog" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "entries" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
