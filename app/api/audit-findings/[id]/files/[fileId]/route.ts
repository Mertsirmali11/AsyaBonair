import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"
import { deletePdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; fileId: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/** DELETE: bulgu dosyasını siler — yetki gerektiren bir işlem olduğu için Audit Plan admini ile sınırlıdır. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, fileId } = await ctx.params
  const findingId = Number(id)
  const fileIdNum = Number(fileId)
  if (!Number.isInteger(findingId) || !Number.isInteger(fileIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const file = await prisma.auditFindingFile.findFirst({
    where: { id: fileIdNum, auditFindingId: findingId },
  })
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await deletePdfFromStorage(file.storagePath)
  await prisma.auditFindingFile.delete({ where: { id: fileIdNum } })

  try {
    const actor = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { id: true, isim: true, soyisim: true },
    })
    await prisma.auditFindingHistory.create({
      data: {
        auditFindingId: findingId,
        actorId: actor?.id ?? null,
        eventType: "FILE_DELETED",
        note: `Dosya "${file.fileName}" ${calisanName(actor)} tarafından silindi.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile silme işlemi geçerli kalır
  }

  return NextResponse.json({ success: true })
}
