-- Outgoing correspondence: configurable departments + released number pool
CREATE TABLE IF NOT EXISTS "outgoing_correspondence_dept_configs" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(40) NOT NULL UNIQUE,
  "label" VARCHAR(200) NOT NULL,
  "paper_prefix" VARCHAR(50) NOT NULL UNIQUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "outgoing_correspondence_dept_configs_is_active_sort_order_idx"
  ON "outgoing_correspondence_dept_configs" ("is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "outgoing_correspondence_released_slots" (
  "id" SERIAL PRIMARY KEY,
  "department_key" VARCHAR(40) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outgoing_correspondence_released_slots_department_key_fkey"
    FOREIGN KEY ("department_key") REFERENCES "outgoing_correspondence_dept_configs" ("key")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "outgoing_correspondence_released_slots_department_key_sequence_key"
    UNIQUE ("department_key", "sequence")
);

CREATE INDEX IF NOT EXISTS "outgoing_correspondence_released_slots_department_key_sequence_idx"
  ON "outgoing_correspondence_released_slots" ("department_key", "sequence");
