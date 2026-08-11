import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
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
 * Bir denetimi iptal eder (Cancelled):
 * - AuditPlanEntry.status → "Cancelled", cancellationReason kaydedilir.
 * - Planlanan tarih, checklist, dosya, finding ve diğer tüm veriler HİÇ değiştirilmez/silinmez.
 * - Geçmiş/Audit History'ye kim/ne zaman/hangi gerekçeyle iptal ettiği bilgisiyle bir kayıt düşülür.
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

  const entry = await prisma.auditPlanEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.status === "Cancelled") {
    return NextResponse.json({ error: "Bu denetim zaten iptal edilmiş." }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { reason?: string } | null
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (!reason) {
    return NextResponse.json({ error: "İptal nedeni zorunludur." }, { status: 400 })
  }

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })
  const actorName = calisanName(actor)

  const [updated] = await prisma.$transaction([
    prisma.auditPlanEntry.update({
      where: { id: entryId },
      data: { status: "Cancelled", cancellationReason: reason },
    }),
    prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: actor?.id ?? null,
        eventType: "CANCELLED",
        statusFrom: entry.status,
        statusTo: "Cancelled",
        note: `Audit cancelled by ${actorName}. Reason: ${reason}`,
      },
    }),
  ])

  return NextResponse.json({ ok: true, status: updated.status, cancellationReason: updated.cancellationReason })
}
