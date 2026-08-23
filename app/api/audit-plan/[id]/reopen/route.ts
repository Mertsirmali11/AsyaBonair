import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || "Bilinmeyen kullanıcı"
}

/**
 * Tamamlanmış (Completed) veya iptal edilmiş (Cancelled) bir denetimi yeniden açar:
 * - AuditPlanEntry.status → "Reopened"
 * - Bu denetime bağlı, "Completed" durumundaki tüm AuditSession'lar → "InProgress"
 *   (checklist maddeleri audit-session-client.tsx'te tekrar düzenlenebilir hale gelir)
 * - Checklist cevapları, finding'ler, dosyalar ve denetçi/denetlenen bilgileri HİÇ değiştirilmez.
 * - cancellationReason (varsa) silinmez — geçmişte kalıcı olarak korunur.
 * - Geçmiş/Audit History'ye kim/ne zaman yeniden açtı bilgisiyle bir kayıt düşülür.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.status !== "Completed" && entry.status !== "Cancelled") {
    return NextResponse.json(
      { error: "Sadece tamamlanmış (Completed) veya iptal edilmiş (Cancelled) denetimler yeniden açılabilir." },
      { status: 400 }
    )
  }

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })

  const actorName = calisanName(actor)
  const statusFrom = entry.status

  const [updated] = await prisma.$transaction([
    prisma.auditPlanEntry.update({
      where: { id: entryId },
      data: { status: "Reopened" },
    }),
    prisma.auditSession.updateMany({
      where: { auditPlanEntryId: entryId, status: "Completed" },
      data: { status: "InProgress", completedAt: null },
    }),
    prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: actor?.id ?? null,
        eventType: "REOPENED",
        statusFrom,
        statusTo: "Reopened",
        note: `Denetim ${actorName} tarafından yeniden açıldı.`,
      },
    }),
  ])

  return NextResponse.json({ ok: true, status: updated.status, actorName })
}
