// Bu dosya sadece Node.js runtime'da kullanılır (API routes, Server Components)
// Edge Runtime'da kullanılamaz
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
  
  // Connection string'i temizle
  const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
    ? connectionString.replace("prisma+postgres://", "postgresql://")
    : connectionString
  
  const pool = new Pool({
    connectionString: cleanConnectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

