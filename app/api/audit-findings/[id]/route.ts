import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { computeCpaUiPermissions } from "@/lib/audit-finding-cpa-access"
import { validateFindingAssignment } from "@/lib/audit-finding-assignee"
import { isSacaOrSafaAuditCategory, normalizeFindingCategory } from "@/lib/finding-category"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

const VALID_LEVELS = ["Level1", "Level2", "Observation"]

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

async function resolveActor(email: string | null | undefined) {
  if (!email) return null
  return prisma.calisan.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  // Admin (Audit Plan) HER ZAMAN erişir; ayrıca bu bulgunun bağlı olduğu denetime bireysel
  // auditee, Auditee Group/Department eşleşmesi veya doğrudan assignedTo olarak atanmış
  // kullanıcılar da görüntüleyip cevap verebilir ("departmandan herhangi bir yetkili kişi").
  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(id, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const entryInclude = {
    auditCategoryType: { select: { name: true } },
    auditSubCategoryType: { select: { name: true } },
    auditees: {
      select: {
        calisan: { select: { id: true, isim: true, soyisim: true } },
      },
    },
    auditeeDepartments: { select: { departmentName: true } },
  } as const

  const finding = await prisma.auditFinding.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true, departman: true } },
      assignedGroup: { select: { id: true, name: true, description: true } },
      responses: {
        orderBy: { submittedAt: "asc" },
        include: {
          respondedBy: { select: { id: true, isim: true, soyisim: true } },
          reviewedBy: { select: { id: true, isim: true, soyisim: true } },
          attachments: true,
        },
      },
      extensions: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { id: true, isim: true, soyisim: true } },
        },
      },
      session: {
        include: {
          entry: { include: entryInclude },
          checklist: { select: { id: true, title: true, checklistNumber: true } },
        },
      },
      // Denetim Planı panelinden manuel eklenen bulgularda session yerine doğrudan entry bağlıdır
      manualEntry: { include: entryInclude },
      sessionItem: {
        include: { checklistItem: true },
      },
    },
  })

  if (!finding || finding.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { manualEntry, session: findingSession, ...rest } = finding

  // Checklist tabanlı ve manuel bulguları istemci için tek biçimde döndür — manuel
  // bulgularda gerçek AuditSession/checklist yoktur, ancak "entry" (kategori/denetlenenler)
  // bilgisi aynı şekle sokularak finding-detail-client.tsx hiç değişmeden çalışabilir.
  const normalizedSession = findingSession
    ? findingSession
    : manualEntry
      ? { entry: manualEntry, checklist: null }
      : null

  // Client'a ham grup üyelik listesi SIZDIRILMAZ — yalnızca "bu kullanıcı cevap/review
  // yapabilir mi" boolean'ları döner, gerçek enforcement her zaman ilgili POST/PATCH'tedir.
  const cpaPermissions = await computeCpaUiPermissions(id, authSession?.user?.email)

  return NextResponse.json({ ...rest, session: normalizedSession, cpaPermissions })
}

/** Bu bulgunun bağlı olduğu denetimin audit category adı — SACA/SAFA normalize kontrolü için. */
async function resolveFindingCategoryName(id: number): Promise<string | null> {
  const finding = await prisma.auditFinding.findUnique({
    where: { id },
    select: {
      session: { select: { entry: { select: { auditCategoryType: { select: { name: true } } } } } },
      manualEntry: { select: { auditCategoryType: { select: { name: true } } } },
    },
  })
  return (
    finding?.session?.entry.auditCategoryType.name ??
    finding?.manualEntry?.auditCategoryType.name ??
    null
  )
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const existing = await prisma.auditFinding.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>

  const data: Record<string, unknown> = {}
  const changedLabels: string[] = []

  if (typeof b.status === "string" && b.status !== existing.status) {
    data.status = b.status
    changedLabels.push("durum")
  }
  if (typeof b.explanation === "string") {
    const v = b.explanation.trim()
    if (v && v !== existing.explanation) {
      data.explanation = v
      changedLabels.push("açıklama")
    }
  }
  if (typeof b.reference === "string") {
    const v = b.reference.trim() || null
    if (v !== existing.reference) {
      data.reference = v
      changedLabels.push("referans")
    }
  }
  if (typeof b.dueDate === "string") {
    const v = b.dueDate ? new Date(b.dueDate) : null
    if (v?.getTime() !== existing.dueDate?.getTime()) {
      data.dueDate = v
      changedLabels.push("vade tarihi")
    }
  }
  // Person ↔ Group karşılıklı dışlayıcı — hangisi gönderilirse DİĞERİ otomatik null'a çekilir
  // (Person → Group veya Group → Person yeniden atama, iki alanı ayrı ayrı yönetmeye gerek yok).
  if (b.assignedGroupId !== undefined) {
    const v = b.assignedGroupId ? Number(b.assignedGroupId) : null
    if (v !== existing.assignedGroupId) {
      data.assignedGroupId = v
      if (existing.assignedToId !== null) data.assignedToId = null
      changedLabels.push("sorumlu grup")
    }
  } else if (b.assignedToId !== undefined) {
    const v = b.assignedToId ? Number(b.assignedToId) : null
    if (v !== existing.assignedToId) {
      data.assignedToId = v
      if (existing.assignedGroupId !== null) data.assignedGroupId = null
      changedLabels.push("sorumlu kişi")
    }
  }
  if (data.assignedToId !== undefined || data.assignedGroupId !== undefined) {
    const nextAssignedToId = (data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId) as number | null
    const nextAssignedGroupId = (data.assignedGroupId !== undefined ? data.assignedGroupId : existing.assignedGroupId) as number | null
    const assignmentCheck = await validateFindingAssignment(nextAssignedToId, nextAssignedGroupId)
    if (!assignmentCheck.ok) {
      return NextResponse.json({ error: assignmentCheck.error }, { status: assignmentCheck.status })
    }
  }
  // SACA/SAFA denetimlerine bağlı bulgularda Level artık kullanılmıyor — istemci eski/varsayılan
  // bir Level göndermeye çalışsa bile (ör. eski UI, doğrudan API çağrısı) sessizce YOK SAYILIR;
  // yalnızca frontend'de gizlemek yeterli değil. Diğer audit type'larında davranış değişmedi.
  const categoryName = await resolveFindingCategoryName(id)
  const isSacaSafa = isSacaOrSafaAuditCategory(categoryName)
  if (
    !isSacaSafa &&
    typeof b.findingLevel === "string" &&
    VALID_LEVELS.includes(b.findingLevel) &&
    b.findingLevel !== existing.findingLevel
  ) {
    data.findingLevel = b.findingLevel
    changedLabels.push("seviye")
  }
  if (b.findingCategory !== undefined) {
    const v = normalizeFindingCategory(b.findingCategory, categoryName)
    // SACA/SAFA'da Category zorunlu — geçersiz/boş bir değerle mevcut kategoriyi sessizce
    // null'a düşürmeyiz, isteği reddederiz.
    if (isSacaSafa && !v) {
      return NextResponse.json({ error: "Finding Category zorunludur" }, { status: 400 })
    }
    if (v !== existing.findingCategory) {
      data.findingCategory = v
      changedLabels.push("kategori")
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(existing)
  }

  const updated = await prisma.auditFinding.update({ where: { id }, data })

  try {
    const actor = await resolveActor(session.user?.email)
    await prisma.auditFindingHistory.create({
      data: {
        auditFindingId: id,
        actorId: actor?.id ?? null,
        eventType: "UPDATED",
        note: `Finding updated by ${calisanName(actor)}${changedLabels.length ? ` (${changedLabels.join(", ")})` : ""}.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile güncelleme geçerli kalır
  }

  return NextResponse.json(updated)
}

/**
 * DELETE: bulguyu soft-delete eder (deletedAt) — hard delete YAPMAZ, kendi
 * AuditFindingHistory kaydı kaybolmasın diye. Yalnızca Audit Plan admini kullanabilir.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const existing = await prisma.auditFinding.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const actor = await resolveActor(session.user?.email)

  await prisma.auditFinding.update({ where: { id }, data: { deletedAt: new Date() } })

  try {
    await prisma.auditFindingHistory.create({
      data: {
        auditFindingId: id,
        actorId: actor?.id ?? null,
        eventType: "DELETED",
        note: `Finding deleted by ${calisanName(actor)}.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile silme işlemi geçerli kalır
  }

  return NextResponse.json({ success: true })
}
