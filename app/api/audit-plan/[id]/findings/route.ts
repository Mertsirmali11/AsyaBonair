import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { isSacaOrSafaAuditCategory, normalizeFindingCategory } from "@/lib/finding-category"
import { validateFindingAssignment } from "@/lib/audit-finding-assignee"
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
      deletedAt: null,
      OR: [{ auditPlanEntryId: entryId }, { session: { auditPlanEntryId: entryId } }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true, departman: true } },
      assignedGroup: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    findings.map((f) => ({
      id: f.id,
      findingCode: f.findingCode,
      findingLevel: f.findingLevel,
      findingCategory: f.findingCategory,
      explanation: f.explanation,
      status: f.status,
      dueDate: f.dueDate ? f.dueDate.toISOString() : null,
      isManual: f.auditSessionId === null,
      assignedTo: f.assignedTo
        ? { id: f.assignedTo.id, name: calisanName(f.assignedTo), department: f.assignedTo.departman }
        : null,
      assignedGroup: f.assignedGroup ? { id: f.assignedGroup.id, name: f.assignedGroup.name } : null,
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
    findingCategory?: string | null
    explanation?: string
    reference?: string
    assignedToId?: number | null
    /** Person/Group karşılıklı dışlayıcı — bkz. lib/audit-finding-assignee.ts */
    assignedGroupId?: number | null
    dueDate?: string | null
    /** Manage Audit → Auditee Responses'ta "Add Finding" bir submission satırından açıldıysa
     * dolu — bulgu bu checklist maddesine otomatik referans olarak bağlanır (bkz. aşağı). */
    auditSessionItemId?: number | null
  } | null

  const isSacaSafa = isSacaOrSafaAuditCategory(entry.auditCategoryType.name)

  // SACA/SAFA denetimlerinde tek sınıflandırma findingCategory'dir — findingLevel gönderilse
  // bile YOK SAYILIR, hiçbir default/eski Level değeri kaydedilmez. Diğer audit type'larında
  // (Internal, External, vb.) mevcut Level davranışı aynen korunur.
  let findingLevel: string | null = null
  if (!isSacaSafa) {
    findingLevel = typeof body?.findingLevel === "string" ? body.findingLevel : "Level1"
    if (!VALID_LEVELS.includes(findingLevel)) {
      return NextResponse.json({ error: "Invalid findingLevel" }, { status: 400 })
    }
  }

  // SACA/SAFA'da findingCategory ZORUNLU (server-side); diğer audit type'larda gelen değer
  // ne olursa olsun null'a zorlanır (normalizeFindingCategory zaten bunu yapıyor).
  const findingCategory = normalizeFindingCategory(body?.findingCategory, entry.auditCategoryType.name)
  if (isSacaSafa && !findingCategory) {
    return NextResponse.json({ error: "Finding Category zorunludur" }, { status: 400 })
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

  // SACA/SAFA'da Level olmadığı için otomatik vade hesaplaması YAPILAMAZ — Due Date kullanıcı
  // tarafından manuel girilir ve ZORUNLUDUR. Diğer audit type'larında mevcut davranış aynen
  // korunur: Level1 +10 gün, Level2 +90 gün, Observation süresiz (manuel dueDate gönderilse
  // bile o audit type'larında yok sayılır — mevcut Level tabanlı davranış bozulmaz).
  let dueDate: Date | null = null
  if (isSacaSafa) {
    const raw = typeof body?.dueDate === "string" ? body.dueDate.trim() : ""
    if (!raw) {
      return NextResponse.json({ error: "Due Date zorunludur" }, { status: 400 })
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Geçersiz Due Date" }, { status: 400 })
    }
    dueDate = parsed
  } else if (findingLevel === "Level1") {
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 10)
  } else if (findingLevel === "Level2") {
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 90)
  }

  // Person/Group karşılıklı dışlayıcı. assignedGroupId AÇIKÇA gönderildiyse (dolu) grup ataması
  // kullanılır (kişi null kalır) — mevcut "ilk denetlenene otomatik ata" varsayımı yalnızca
  // NE assignedToId NE DE assignedGroupId gönderilmediğinde devreye girer (geriye dönük uyumluluk,
  // mevcut person-assigned davranış birebir korunur).
  let assignedToId: number | null
  let assignedGroupId: number | null
  if (body?.assignedGroupId) {
    assignedGroupId = Number(body.assignedGroupId)
    assignedToId = null
  } else if (body?.assignedToId !== undefined) {
    assignedToId = body.assignedToId ? Number(body.assignedToId) : null
    assignedGroupId = null
  } else {
    assignedToId = entry.auditees[0]?.calisanId ?? null
    assignedGroupId = null
  }

  const assignmentCheck = await validateFindingAssignment(assignedToId, assignedGroupId)
  if (!assignmentCheck.ok) {
    return NextResponse.json({ error: assignmentCheck.error }, { status: assignmentCheck.status })
  }

  // Manage Audit → Auditee Responses'tan "Add Finding" ile açıldıysa ilgili checklist maddesine
  // otomatik referans bağla. auditSessionItemId @unique olduğu için (bir soruya en fazla bir
  // finding) — o soru için zaten bir finding varsa (ör. auditor daha önce Unsatisfactory
  // işaretlemiş) linki KURMUYORUZ, yalnızca bulguyu bağlantısız (auditPlanEntryId üzerinden)
  // oluşturuyoruz; unique constraint ihlali/500 hatası riske edilmez.
  let linkedAuditSessionId: number | null = null
  let linkedAuditSessionItemId: number | null = null
  const requestedSessionItemId = Number(body?.auditSessionItemId)
  if (Number.isInteger(requestedSessionItemId) && requestedSessionItemId > 0) {
    const sessionItem = await prisma.auditSessionItem.findFirst({
      where: { id: requestedSessionItemId, session: { auditPlanEntryId: entry.id } },
      select: { id: true, auditSessionId: true, finding: { select: { id: true } } },
    })
    if (sessionItem && !sessionItem.finding) {
      linkedAuditSessionId = sessionItem.auditSessionId
      linkedAuditSessionItemId = sessionItem.id
    }
  }

  const finding = await prisma.auditFinding.create({
    data: {
      findingCode,
      // auditSessionItemId bağlanabiliyorsa checklist-kaynaklı bulgularla aynı desende
      // (auditSessionId + auditSessionItemId), aksi halde manuel bulgularla aynı desende
      // (yalnızca auditPlanEntryId) oluşturulur — iki ayrı finding oluşturma yolu YOKTUR,
      // yalnızca hangi FK'lerin dolu olduğu değişir.
      ...(linkedAuditSessionItemId
        ? { auditSessionId: linkedAuditSessionId, auditSessionItemId: linkedAuditSessionItemId }
        : { auditPlanEntryId: entry.id }),
      findingLevel,
      findingCategory,
      explanation,
      reference,
      field,
      auditNumber,
      dueDate,
      status: "Open",
      ...(assignedToId ? { assignedToId } : {}),
      ...(assignedGroupId ? { assignedGroupId } : {}),
    },
    include: { assignedGroup: { select: { id: true, name: true } } },
  })

  try {
    const actor = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { id: true, isim: true, soyisim: true },
    })
    const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entry.id,
        actorId: actor?.id ?? null,
        eventType: linkedAuditSessionItemId ? "FINDING_CREATED_FROM_AUDITEE_RESPONSE" : "FINDING_CREATED",
        note: linkedAuditSessionItemId
          ? `Bulgu ${finding.findingCode} ${actorName} tarafından bir auditee response'tan oluşturuldu.`
          : `Bulgu ${finding.findingCode} ${actorName} tarafından oluşturuldu.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile bulgu oluşturma geçerli kalır
  }

  return NextResponse.json(finding, { status: 201 })
}
