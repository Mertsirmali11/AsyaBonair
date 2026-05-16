-- Supabase (ve pgvector kurulu Postgres): `db push` / migrasyon önce bu eklentiyi açın.
-- Dashboard → SQL Editor’da bir kez çalıştırın, ardından tekrar `pnpm exec prisma db push`.
CREATE EXTENSION IF NOT EXISTS vector;
