import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const VALID_LEVELS = ["Level1", "Level2", "Observation"]

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

/**
 * GET: bu denetim kaydına ait TÜM bulgular — hem checklist üzerinden (Unsatisfactory
 * sonucuyla) otomatik oluşanlar hem de bu uç noktadan manuel eklenenler. "Bulgu / notlar"
 * panelinde özet liste olarak gösterilir.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const findings = await prisma.auditFinding.findMany({
    where: {
      OR: [{ auditPlanEntryId: entryId }, { session: { auditPlanEntryId: entryId } }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true, departman: true } },
    },
  })

  return NextResponse.json(
    findings.map((f) => ({
      id: f.id,
      findingCode: f.findingCode,
      findingLevel: f.findingLevel,
      explanation: f.explanation,
      status: f.status,
      dueDate: f.dueDate ? f.dueDate.toISOString() : null,
      isManual: f.auditSessionId === null,
      assignedTo: f.assignedTo
        ? { id: f.assignedTo.id, name: calisanName(f.assignedTo), department: f.assignedTo.departman }
        : null,
    }))
  )
}

/**
 * POST: Denetim Planı detay panelindeki "Bulgu Ekle" ile manuel bulgu oluşturur.
 * Mevcut standart Finding modelini/numbering'ini/atama mantığını aynen kullanır —
 * checklist maddesi ZORUNLU DEĞİLDİR (auditSessionItemId null bırakılır).
 * Checklist üzerinden otomatik bulgu oluşturma akışına (audit-sessions/[id]/items) dokunulmaz.
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: entryId },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
      auditees: { select: { calisanId: true }, take: 1 },
    },
  })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    findingLevel?: string
    explanation?: string
    reference?: string
    assignedToId?: number | null
  } | null

  const findingLevel = typeof body?.findingLevel === "string" ? body.findingLevel : "Level1"
  if (!VALID_LEVELS.includes(findingLevel)) {
    return NextResponse.json({ error: "Invalid findingLevel" }, { status: 400 })
  }

  const explanation = typeof body?.explanation === "string" ? body.explanation.trim() : ""
  if (!explanation) {
    return NextResponse.json({ error: "Açıklama zorunludur" }, { status: 400 })
  }

  const reference = typeof body?.reference === "string" ? body.reference.trim() || null : null

  // Aynı numbering mantığı: BON-AF-XXX (checklist üzerinden otomatik oluşan bulgularla aynı sayaç)
  const count = await prisma.auditFinding.count()
  const findingCode = `BON-AF-${String(count + 1).padStart(3, "0")}`

  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  const auditNumber = entry.auditNumberPrefix ? `${entry.auditNumberPrefix}-${entry.id}` : `AP-${entry.id}`

  // Aynı vade tarihi mantığı: Level1 +10 gün, Level2 +90 gün, Observation süresiz
  let dueDate: Date | null = null
  if (findingLevel === "Level1") {
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 10)
  } else if (findingLevel === "Level2") {
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 90)
  }

  // assignedToId gönderilmişse (null dahil) onu kullan, yoksa ilk denetlenen kişiye ata (otomatik oluşan bulgularla aynı varsayılan davranış)
  const assignedToId =
    body?.assignedToId !== undefined
      ? body.assignedToId
        ? Number(body.assignedToId)
        : null
      : (entry.auditees[0]?.calisanId ?? null)

  const finding = await prisma.auditFinding.create({
    data: {
      findingCode,
      auditPlanEntryId: entry.id,
      findingLevel,
      explanation,
      reference,
      field,
      auditNumber,
      dueDate,
      status: "Open",
      ...(assignedToId ? { assignedToId } : {}),
    },
  })

  return NextResponse.json(finding, { status: 201 })
}
