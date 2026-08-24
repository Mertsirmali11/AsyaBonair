/**
 * Gerçek prod DB'ye karşı self-contained smoke test — yeni Compliance Monitoring modülleri
 * (Unplanned/Incoming Audits, Audit Settings scopes, Auditing Body, Audit Plan Revision).
 * Kendi test verisini oluşturur, doğrular, SONRA TAMAMEN TEMİZLER — hiçbir kalıcı iz bırakmaz.
 * Mevcut hiçbir kayda dokunmaz (yalnızca "__SMOKE_TEST__" işaretli kendi satırlarını
 * oluşturup siler; revizyon testleri gerçek yıllarla çakışmasın diye year=9999 kullanır).
 *
 * Standalone PrismaClient (server-only import'u olmayan) — HTTP/auth gerektirmez.
 *
 * Çalıştırma: npx tsx scripts/smoke-test-compliance-new-modules.ts
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
if (!connectionString) throw new Error("DATABASE_URL is not set.")
const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({ connectionString: cleanConnectionString, max: 3, connectionTimeoutMillis: 20000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error", "warn"] })

const SMOKE_YEAR = 9999 // gerçek hiçbir Audit Plan yılıyla çakışmaz
let failed = 0
function check(name: string, cond: boolean, detail?: unknown) {
  const ok = !!cond
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ""}`)
}

async function main() {
  console.log("=== Baseline counts (pre-test) ===")
  const baseline = {
    categories: await prisma.auditCategoryType.count(),
    bodies: await prisma.auditingBodyType.count(),
    entries: await prisma.auditPlanEntry.count(),
    revisions: await prisma.auditPlanRevision.count(),
  }
  console.log(baseline)

  // --- 1) AuditCategoryType.scopes ---
  const category = await prisma.auditCategoryType.create({
    data: {
      name: "__SMOKE_TEST_CATEGORY__",
      scopes: ["UNPLANNED", "INCOMING"],
      sortOrder: -999,
      isActive: true,
    },
  })
  check("category created with scopes", category.scopes.length === 2, category.scopes)

  const foundByScope = await prisma.auditCategoryType.findMany({
    where: { scopes: { has: "UNPLANNED" } },
    select: { id: true },
  })
  check(
    "scopes: {has} filter finds the smoke category",
    foundByScope.some((c) => c.id === category.id)
  )

  // --- 2) AuditingBodyType ---
  const body = await prisma.auditingBodyType.create({
    data: { name: "__SMOKE_TEST_BODY__", sortOrder: -999, isActive: true },
  })
  check("auditing body created", !!body.id)

  // --- 3) AuditPlanEntry auditType=UNPLANNED ---
  const unplannedEntry = await prisma.auditPlanEntry.create({
    data: {
      auditType: "UNPLANNED",
      plannedDate: new Date(Date.UTC(SMOKE_YEAR, 0, 1)),
      auditCategoryTypeId: category.id,
      status: "Planned",
    },
  })
  check("UNPLANNED entry created", unplannedEntry.auditType === "UNPLANNED")
  check("UNPLANNED entry auditingBodyTypeId is null", unplannedEntry.auditingBodyTypeId === null)

  // --- 4) AuditPlanEntry auditType=INCOMING + auditingBodyTypeId ---
  const incomingEntry = await prisma.auditPlanEntry.create({
    data: {
      auditType: "INCOMING",
      auditingBodyTypeId: body.id,
      plannedDate: new Date(Date.UTC(SMOKE_YEAR, 0, 2)),
      auditCategoryTypeId: category.id,
      status: "Planned",
    },
    include: { auditingBodyType: { select: { name: true } } },
  })
  check("INCOMING entry created", incomingEntry.auditType === "INCOMING")
  check(
    "INCOMING entry auditingBodyType resolves",
    incomingEntry.auditingBodyType?.name === "__SMOKE_TEST_BODY__"
  )

  // Existing PLANNED entries must be completely unaffected by the two new rows above.
  const plannedCountAfter = await prisma.auditPlanEntry.count({ where: { auditType: "PLANNED" } })
  check(
    "existing PLANNED entries count unchanged",
    plannedCountAfter === baseline.entries, // baseline.entries counted ALL rows, all were PLANNED pre-test
    { before: baseline.entries, after: plannedCountAfter }
  )

  // --- 5) AuditPlanRevision auto-numbering (year=9999, isolated) ---
  const rev0 = await prisma.auditPlanRevision.create({
    data: { year: SMOKE_YEAR, revisionNumber: 0, revisionDate: new Date(), reason: "smoke test rev 0" },
  })
  check("first revision is Rev 0", rev0.revisionNumber === 0)

  const maxAgg = await prisma.auditPlanRevision.aggregate({
    where: { year: SMOKE_YEAR },
    _max: { revisionNumber: true },
  })
  const nextNumber = (maxAgg._max.revisionNumber ?? -1) + 1
  const rev1 = await prisma.auditPlanRevision.create({
    data: { year: SMOKE_YEAR, revisionNumber: nextNumber, revisionDate: new Date(), reason: "smoke test rev 1" },
  })
  check("second revision auto-increments to Rev 1", rev1.revisionNumber === 1)

  // Unique constraint sanity: creating a duplicate (year, revisionNumber) must fail.
  let duplicateRejected = false
  try {
    await prisma.auditPlanRevision.create({
      data: { year: SMOKE_YEAR, revisionNumber: 0, revisionDate: new Date(), reason: "should fail" },
    })
  } catch {
    duplicateRejected = true
  }
  check("duplicate (year, revisionNumber) rejected by unique constraint", duplicateRejected)

  // --- Cleanup (reverse dependency order) ---
  console.log("\n=== Cleanup ===")
  await prisma.auditPlanRevision.deleteMany({ where: { year: SMOKE_YEAR } })
  await prisma.auditPlanEntry.delete({ where: { id: incomingEntry.id } })
  await prisma.auditPlanEntry.delete({ where: { id: unplannedEntry.id } })
  await prisma.auditingBodyType.delete({ where: { id: body.id } })
  await prisma.auditCategoryType.delete({ where: { id: category.id } })

  const after = {
    categories: await prisma.auditCategoryType.count(),
    bodies: await prisma.auditingBodyType.count(),
    entries: await prisma.auditPlanEntry.count(),
    revisions: await prisma.auditPlanRevision.count(),
  }
  console.log(after)
  check("counts restored to baseline after cleanup", JSON.stringify(after) === JSON.stringify(baseline), {
    baseline,
    after,
  })

  if (failed > 0) {
    console.error(`\n${failed} case(s) FAILED`)
    process.exitCode = 1
  } else {
    console.log("\nAll smoke-test cases passed, no residual test data left in DB.")
  }
}

main()
  .catch(async (e) => {
    console.error("SMOKE TEST CRASHED:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
