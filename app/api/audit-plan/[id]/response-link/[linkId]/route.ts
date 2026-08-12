import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; linkId: string }> }

async function requireAuditPlanAccess() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) return null
  return session
}

/**
 * PATCH: mevcut bir response link üzerinde yetkili kullanıcı işlemi —
 * revoke (devre dışı bırak), reactivate (Reopen SONRASI, yetkili kullanıcının AÇIK
 * onayıyla aynı token'ı yeniden etkinleştirir — otomatik olmaz), veya expiresAt güncelleme.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, linkId } = await ctx.params
  const entryId = Number(id)
  const linkIdNum = Number(linkId)
  if (!Number.isInteger(entryId) || entryId < 1 || !Number.isInteger(linkIdNum) || linkIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const link = await prisma.auditResponseLink.findFirst({ where: { id: linkIdNum, auditPlanEntryId: entryId } })
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as {
    action?: "revoke" | "reactivate" | "set-expiry"
    expiresAt?: string | null
  } | null
  const action = body?.action

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user!.email!, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })
  const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"

  let data: { revokedAt?: Date | null; expiresAt?: Date | null } = {}
  let eventType = ""
  let historyNote = ""

  if (action === "revoke") {
    if (link.revokedAt) return NextResponse.json({ error: "Zaten devre dışı." }, { status: 400 })
    data = { revokedAt: new Date() }
    eventType = "RESPONSE_LINK_REVOKED"
    historyNote = `Public Audit Response Link ${actorName} tarafından devre dışı bırakıldı.`
  } else if (action === "reactivate") {
    if (!link.revokedAt) return NextResponse.json({ error: "Zaten aktif." }, { status: 400 })
    data = { revokedAt: null }
    eventType = "RESPONSE_LINK_REACTIVATED"
    historyNote = `Public Audit Response Link ${actorName} tarafından yeniden etkinleştirildi.`
  } else if (action === "set-expiry") {
    let expiresAt: Date | null = null
    if (typeof body?.expiresAt === "string" && body.expiresAt.trim()) {
      const d = new Date(body.expiresAt)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 })
      expiresAt = d
    }
    data = { expiresAt }
    eventType = "RESPONSE_LINK_EXPIRY_CHANGED"
    historyNote = `Public Audit Response Link son kullanma tarihi ${actorName} tarafından ${expiresAt ? expiresAt.toLocaleDateString("tr-TR") : "süresiz"} olarak güncellendi.`
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const updated = await prisma.auditResponseLink.update({ where: { id: linkIdNum }, data })

  try {
    await prisma.auditPlanEntryHistory.create({
      data: { auditPlanEntryId: entryId, actorId: actor?.id ?? null, eventType, note: historyNote },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile güncelleme geçerli kalır
  }

  return NextResponse.json({
    id: updated.id,
    revokedAt: updated.revokedAt ? updated.revokedAt.toISOString() : null,
    expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
  })
}
