import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { generateResponseToken, revokeActiveResponseLinksForEntry } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

async function requireAuditPlanAccess() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) return null
  return session
}

function mapLink(link: {
  id: number
  token: string
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  creator: { isim: string | null; soyisim: string | null } | null
}) {
  const now = Date.now()
  const isExpired = !!link.expiresAt && link.expiresAt.getTime() < now
  return {
    id: link.id,
    token: link.token,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    revokedAt: link.revokedAt ? link.revokedAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
    createdByName: calisanName(link.creator),
    isActive: !link.revokedAt && !isExpired,
    isExpired,
  }
}

/** GET: bu denetime ait tüm response link'ler (aktif + geçmiş) — Manage Audit paneli için. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const links = await prisma.auditResponseLink.findMany({
    where: { auditPlanEntryId: entryId },
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(links.map(mapLink))
}

/**
 * POST: yeni bir response link oluşturur — bu denetime ait hâlâ aktif (revoke edilmemiş)
 * başka bir link varsa önce onu otomatik iptal eder (aynı anda tek aktif link ilkesi).
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({ where: { id: entryId }, select: { id: true } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as { expiresAt?: string | null } | null
  let expiresAt: Date | null = null
  if (typeof body?.expiresAt === "string" && body.expiresAt.trim()) {
    const d = new Date(body.expiresAt)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 })
    }
    expiresAt = d
  }

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user!.email!, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })
  const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"

  await revokeActiveResponseLinksForEntry(entryId)

  const link = await prisma.auditResponseLink.create({
    data: {
      auditPlanEntryId: entryId,
      token: generateResponseToken(),
      expiresAt,
      createdBy: actor?.id ?? null,
    },
    include: { creator: { select: { isim: true, soyisim: true } } },
  })

  try {
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: actor?.id ?? null,
        eventType: "RESPONSE_LINK_CREATED",
        note: `Public Audit Response Link ${actorName} tarafından oluşturuldu.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile link oluşturma geçerli kalır
  }

  return NextResponse.json(mapLink(link), { status: 201 })
}
