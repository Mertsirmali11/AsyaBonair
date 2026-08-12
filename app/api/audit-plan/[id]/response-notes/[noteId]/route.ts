import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; noteId: string }> }

/**
 * DELETE: bir auditee notunu kalıcı olarak siler — YALNIZCA yetkili bir Bonjour
 * kullanıcısı bu işlemi yapabilir (public response link üzerinden asla silinemez).
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, noteId } = await ctx.params
  const entryId = Number(id)
  const noteIdNum = Number(noteId)
  if (!Number.isInteger(entryId) || entryId < 1 || !Number.isInteger(noteIdNum) || noteIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const note = await prisma.auditResponseNote.findFirst({ where: { id: noteIdNum, auditPlanEntryId: entryId } })
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.auditResponseNote.delete({ where: { id: noteIdNum } })

  try {
    const actor = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { id: true, isim: true, soyisim: true },
    })
    const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: actor?.id ?? null,
        eventType: "RESPONSE_NOTE_DELETED",
        note: `Auditee note deleted by ${actorName}.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile silme işlemi geçerli kalır
  }

  return NextResponse.json({ ok: true })
}
