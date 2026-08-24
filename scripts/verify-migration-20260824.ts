/**
 * Read-only post-migration verification for
 * 20260824120000_compliance_unplanned_incoming_audits_and_plan_revision.
 * Does NOT write anything — only counts/reads. Safe to run against prod.
 * Standalone PrismaClient (like prisma/seed.ts) — does NOT import lib/prisma-server.ts, which
 * is "server-only" and cannot be required from a plain tsx/CJS script.
 *
 * Çalıştırma: npx tsx scripts/verify-migration-20260824.ts
 */
import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.")
}
const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({ connectionString: cleanConnectionString, max: 3, connectionTimeoutMillis: 20000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error", "warn"] })

async function main() {
  console.log("=== Audit Plan Entries ===")
  const totalEntries = await prisma.auditPlanEntry.count()
  const plannedEntries = await prisma.auditPlanEntry.count({ where: { auditType: "PLANNED" } })
  const nonPlannedEntries = await prisma.auditPlanEntry.count({ where: { auditType: { not: "PLANNED" } } })
  const withAuditingBody = await prisma.auditPlanEntry.count({ where: { auditingBodyTypeId: { not: null } } })
  console.log(
    `total=${totalEntries} PLANNED=${plannedEntries} non-PLANNED(should be 0)=${nonPlannedEntries} withAuditingBody(should be 0)=${withAuditingBody}`
  )

  console.log("\n=== Audit Category Types (scopes) ===")
  const categories = await prisma.auditCategoryType.findMany({
    select: { id: true, name: true, scopes: true },
    orderBy: { id: "asc" },
  })
  const notPlannedOnly = categories.filter((c) => c.scopes.length !== 1 || c.scopes[0] !== "PLANNED")
  console.log(`totalCategories=${categories.length} notExactlyPlanned(should be 0)=${notPlannedOnly.length}`)
  if (notPlannedOnly.length > 0) {
    console.log("Unexpected scopes rows:", notPlannedOnly)
  }

  console.log("\n=== Sessions / Findings / Checklists (unchanged?) ===")
  const sessions = await prisma.auditSession.count()
  const findings = await prisma.auditFinding.count()
  const checklists = await prisma.auditChecklist.count()
  console.log(`sessions=${sessions} findings=${findings} checklists=${checklists}`)

  console.log("\n=== New tables exist and are empty (nothing written yet) ===")
  const auditingBodyTypes = await prisma.auditingBodyType.count()
  const planRevisions = await prisma.auditPlanRevision.count()
  const planRevisionFiles = await prisma.auditPlanRevisionFile.count()
  console.log(
    `auditingBodyTypes=${auditingBodyTypes} auditPlanRevisions=${planRevisions} auditPlanRevisionFiles=${planRevisionFiles}`
  )

  console.log("\n=== New FK constraints (ON DELETE behavior) ===")
  const fkRows = await prisma.$queryRaw<{ conname: string; confdeltype: string; source: string; target: string }[]>`
    SELECT
      c.conname,
      c.confdeltype::text AS confdeltype,
      src.relname AS source,
      tgt.relname AS target
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class tgt ON tgt.oid = c.confrelid
    WHERE c.contype = 'f'
      AND src.relname IN ('audit_plan_entries', 'audit_plan_revisions', 'audit_plan_revision_files')
      AND (c.conname LIKE '%auditing_body%' OR c.conname LIKE '%audit_plan_revision%')
    ORDER BY src.relname, c.conname
  `
  // confdeltype: a = no action, r = restrict, c = cascade, n = set null, d = set default
  for (const r of fkRows) {
    console.log(`${r.source} -> ${r.target} (${r.conname}): ON DELETE ${r.confdeltype}`)
  }

  console.log("\n=== New indexes ===")
  const idxRows = await prisma.$queryRaw<{ tablename: string; indexname: string }[]>`
    SELECT tablename, indexname FROM pg_indexes
    WHERE tablename IN ('audit_plan_entries', 'audit_category_types', 'auditing_body_types', 'audit_plan_revisions', 'audit_plan_revision_files')
      AND (indexname LIKE '%audit_type%' OR indexname LIKE '%auditing_body%' OR indexname LIKE '%audit_plan_revision%')
    ORDER BY tablename, indexname
  `
  for (const r of idxRows) console.log(`  ${r.tablename}.${r.indexname}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
