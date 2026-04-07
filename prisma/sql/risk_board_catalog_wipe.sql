-- Tüm risk board listesi ve bow-tie kayıtlarını boşaltır (isteğe bağlı bakım).
DELETE FROM "safety_risk_boards";
INSERT INTO "safety_risk_board_catalog" ("id", "entries", "updated_at")
VALUES (1, '[]'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "entries" = EXCLUDED."entries",
  "updated_at" = CURRENT_TIMESTAMP;
