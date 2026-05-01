import "server-only"

import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

/** Şemada alan/model değişince artırın; dev’de global’deki eski PrismaClient’ı atar. */
const PRISMA_CLIENT_CACHE_REVISION = 11 // bumped: DepartmentTitle + LeaveRequest + Calisan.titleId/workLocation

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaClientCacheRevision?: number
}

/** Supabase: 5432 = session pooler (çok düşük eşzamanlı bağlantı); 6543 = transaction (PgBouncer). */
function defaultPoolMaxForUrl(url: string): number {
  try {
    const u = new URL(url.replace(/^prisma\+postgres:\/\//, "postgresql://"))
    const host = u.hostname
    const port = u.port || "5432"
    const isSupabasePooler =
      host.endsWith("pooler.supabase.com") || host.includes(".pooler.supabase.com")
    if (isSupabasePooler && port === "5432") {
      // Session mode: sunucu "MaxClientsInSessionMode" ile pool_size sınırı koyar; tek bağlantı güvenli.
      return 1
    }
    if (isSupabasePooler && port === "6543") {
      return process.env.VERCEL ? 5 : 10
    }
  } catch {
    /* URL parse edilemezse aşağıdaki varsayılan */
  }
  return process.env.VERCEL ? 5 : 15
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  
  const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
    ? connectionString.replace("prisma+postgres://", "postgresql://")
    : connectionString
  
  const rawPool = process.env.DATABASE_POOL_MAX
  const parsedPool = rawPool ? Number(rawPool) : NaN
  const poolMax =
    Number.isFinite(parsedPool) && parsedPool > 0
      ? parsedPool
      : defaultPoolMaxForUrl(cleanConnectionString)

  const rawConnTimeout = process.env.DATABASE_CONNECTION_TIMEOUT_MS
    ? Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS)
    : NaN
  const connectionTimeoutMillis =
    Number.isFinite(rawConnTimeout) && rawConnTimeout >= 1000 && rawConnTimeout <= 120_000
      ? rawConnTimeout
      : 20_000

  const pool = new Pool({
    connectionString: cleanConnectionString,
    max: poolMax,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis,
    statement_timeout: 60000,
    // Allow faster recovery when a connection drops
    allowExitOnIdle: true,
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

/**
 * Tek süreçte tek Prisma + tek pg Pool: dev’de her import’ta yeni havuz açmak
 * Supabase session pooler’da bağlantı tüketimini patlatıyordu.
 *
 * `prisma generate` ile yeni model eklendikten sonra Next dev bazen eski global
 * PrismaClient’ı tutar; `safetyRiskBoardCatalog` vb. delegate undefined kalıp
 * "Cannot read properties of undefined (reading 'findUnique')" üretir. Eksik
 * delegate görülürse önbelleği bırakıp client’ı yeniden oluştururuz.
 */
function prismaHasExpectedDelegates(client: PrismaClient): boolean {
  const c = client as unknown as {
    safetyRiskBoardCatalog?: { findUnique?: unknown }
    supportTicket?: { create?: unknown }
    supportTicketAttachment?: { create?: unknown }
    departmentTitle?: { findMany?: unknown }
    leaveRequest?: { findMany?: unknown }
  }
  return (
    typeof c.safetyRiskBoardCatalog?.findUnique === "function" &&
    typeof c.supportTicket?.create === "function" &&
    typeof c.supportTicketAttachment?.create === "function" &&
    typeof c.departmentTitle?.findMany === "function" &&
    typeof c.leaveRequest?.findMany === "function"
  )
}

function getOrCreatePrisma(): PrismaClient {
  const cacheOk =
    globalForPrisma.__prismaClientCacheRevision === PRISMA_CLIENT_CACHE_REVISION
  const cached = globalForPrisma.prisma
  if (cached && prismaHasExpectedDelegates(cached) && cacheOk) {
    return cached
  }
  if (cached) {
    void cached.$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }
  const created = createPrismaClient()
  globalForPrisma.prisma = created
  globalForPrisma.__prismaClientCacheRevision = PRISMA_CLIENT_CACHE_REVISION
  return created
}

export const prisma = getOrCreatePrisma()

if (process.env.NODE_ENV === "development") {
  const p = prisma as unknown as {
    auditCategoryType?: unknown
    supportTicketAttachment?: unknown
  }
  if (!p.auditCategoryType || !p.supportTicketAttachment) {
    console.error(
      "[prisma] Prisma Client is missing models. Run `pnpm exec prisma generate` and restart `pnpm dev`."
    )
  }
}

