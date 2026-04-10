import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"
import { getAppPublicUrl } from "@/lib/app-public-url"
import { Resend } from "resend"

const ANNOUNCEMENTS_ADMIN_LIST_MAX = 2000

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  return new Resend(key)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM?.trim()
  if (from) return from
  return "Bonair <onboarding@resend.dev>"
}

async function sendAnnouncementEmails(
  resend: Resend,
  emails: string[],
  title: string,
  content: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const from = getFromAddress()
  const subject = `New announcement: ${title}`
  const base = getAppPublicUrl()
  const portalLink = base ? `${base}/dashboard` : ""
  const ackBlock = portalLink
    ? `<p><strong>Okudum, anladım:</strong> Lütfen Bonair portalında <strong>Dashboard</strong> bölümündeki duyuruyu okuyup <strong>«Okudum, anladım»</strong> ile onaylayınız.</p><p><a href="${escapeHtml(portalLink)}">${escapeHtml(portalLink)}</a></p>`
    : `<p><strong>Okudum, anladım:</strong> Lütfen Bonair portalında <strong>Dashboard</strong> bölümündeki duyuruyu okuyup <strong>«Okudum, anladım»</strong> ile onaylayınız.</p>`
  const html = `
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(content).replace(/\n/g, "<br />")}</p>
        ${ackBlock}
        <hr />
        <small>Sent by the Bonair SMS portal.</small>
      `
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const to of emails) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
      })
      if (error) {
        failed += 1
        const msg = `${to}: ${error.message}`
        errors.push(msg)
        console.error("[announcements] Resend error:", msg)
      } else {
        sent += 1
      }
    } catch (e) {
      failed += 1
      const msg = `${to}: ${e instanceof Error ? e.message : String(e)}`
      errors.push(msg)
      console.error("[announcements] Send failed:", msg)
    }
  }

  return { sent, failed, errors }
}

export async function GET() {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: ANNOUNCEMENTS_ADMIN_LIST_MAX,
    include: {
      creator: { select: { isim: true, soyisim: true, departman: true } },
    },
  })
  const totalStaff = await prisma.calisan.count()
  const ids = announcements.map((a) => a.id)
  const ackGroups =
    ids.length === 0
      ? []
      : await prisma.announcementAcknowledgment.groupBy({
          by: ["announcementId"],
          where: { announcementId: { in: ids } },
          _count: { _all: true },
        })
  const countMap = new Map(
    ackGroups.map((g) => [g.announcementId, g._count._all])
  )
  const enriched = announcements.map((a) => ({
    ...a,
    acknowledgedCount: countMap.get(a.id) ?? 0,
    totalStaff,
  }))
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { id: true, departman: true },
  })

  if (!calisan || !["Quality", "Human Resources"].includes(calisan.departman ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : true

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    )
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      isActive,
      createdBy: calisan.id,
    },
    include: {
      creator: { select: { isim: true, soyisim: true, departman: true } },
    },
  })

  const calisanlar = await prisma.calisan.findMany({
    select: { email: true },
  })

  const emails = [...new Set(calisanlar.map((c) => c.email.trim()).filter(Boolean))]

  const resend = getResend()
  let emailDelivery:
    | { skipped: true; reason: string }
    | { sent: number; failed: number; errors: string[] }
    | undefined

  if (!isActive) {
    emailDelivery = {
      skipped: true,
      reason: "Announcement saved as inactive — no email sent",
    }
  } else if (emails.length === 0) {
    emailDelivery = { skipped: true, reason: "No recipient emails in database" }
  } else if (!resend) {
    console.warn(
      "[announcements] RESEND_API_KEY missing or empty — announcement saved, emails not sent."
    )
    emailDelivery = { skipped: true, reason: "RESEND_API_KEY not configured" }
  } else {
    emailDelivery = await sendAnnouncementEmails(resend, emails, title, content)
    if (emailDelivery.failed > 0) {
      console.error("[announcements] Some emails failed:", emailDelivery.errors)
    }
  }

  const totalStaff = await prisma.calisan.count()

  return NextResponse.json({
    ...announcement,
    acknowledgedCount: 0,
    totalStaff,
    _emailDelivery: emailDelivery,
  })
}
