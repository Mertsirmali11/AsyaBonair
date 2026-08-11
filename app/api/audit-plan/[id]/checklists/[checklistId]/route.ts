import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; checklistId: string }> }

/** Denetimden checklist atamasını kaldırır (checklistId = şablon id) */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const p = await ctx.params
  const auditPlanEntryId = Number(p.id)
  const auditChecklistId = Number(p.checklistId)

  if (!Number.isInteger(auditPlanEntryId) || auditPlanEntryId < 1) {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 })
  }
  if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1) {
    return NextResponse.json({ error: "Invalid checklist id" }, { status: 400 })
  }

  const checklist = await prisma.auditChecklist.findUnique({
    where: { id: auditChecklistId },
    select: { title: true },
  })

  const result = await prisma.auditPlanChecklistAssignment.deleteMany({
    where: {
      auditPlanEntryId,
      auditChecklistId,
    },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }

  try {
    const actorEmail = session.user?.email
    const actor = actorEmail
      ? await prisma.calisan.findFirst({
          where: { email: { equals: actorEmail, mode: "insensitive" } },
          select: { id: true, isim: true, soyisim: true },
        })
      : null
    const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId,
        actorId: actor?.id ?? null,
        eventType: "CHECKLIST_REMOVED",
        note: `Checklist "${checklist?.title ?? "—"}" ${actorName} tarafından denetimden kaldırıldı.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile kaldırma işlemi geçerli kalır
  }

  return NextResponse.json({ ok: true })
}
