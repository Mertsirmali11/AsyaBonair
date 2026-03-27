import "server-only"

import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  
  const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
    ? connectionString.replace("prisma+postgres://", "postgresql://")
    : connectionString
  
  const poolMax =
    Number(process.env.DATABASE_POOL_MAX) ||
    (process.env.VERCEL ? 5 : 20)

  const pool = new Pool({
    connectionString: cleanConnectionString,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  
  const adapter = new PrismaPg(pool)
  
  const devLogs: ("query" | "error" | "warn")[] =
    process.env.PRISMA_LOG_QUERIES === "1"
      ? ["query", "error", "warn"]
      : ["error", "warn"]

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? devLogs : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

