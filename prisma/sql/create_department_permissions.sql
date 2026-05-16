-- Opsiyonel: `pnpm exec prisma db push` kullanmıyorsanız elle uygulanabilir.
CREATE TABLE IF NOT EXISTS "department_permissions" (
    "id" TEXT NOT NULL,
    "department_key" VARCHAR(120) NOT NULL,
    "permission_key" VARCHAR(80) NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "department_permissions_department_key_permission_key_key"
ON "department_permissions"("department_key", "permission_key");

CREATE INDEX IF NOT EXISTS "department_permissions_department_key_idx"
ON "department_permissions"("department_key");
