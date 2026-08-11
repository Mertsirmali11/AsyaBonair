import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"
import { deletePdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; docId: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, docId } = await ctx.params
  const entryId = Number(id)
  const documentId = Number(docId)
  if (!Number.isInteger(entryId) || !Number.isInteger(documentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const doc = await prisma.auditPlanDocument.findFirst({
    where: { id: documentId, auditPlanEntryId: entryId },
  })
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await deletePdfFromStorage(doc.storagePath)
  await prisma.auditPlanDocument.delete({ where: { id: documentId } })

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
        eventType: "FILE_DELETED",
        note: `Dosya "${doc.fileName}" ${actorName} tarafından silindi.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile silme işlemi geçerli kalır
  }

  return NextResponse.json({ success: true })
}
