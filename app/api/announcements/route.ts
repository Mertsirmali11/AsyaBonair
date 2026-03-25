import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { Resend } from "resend"

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
  const html = `
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(content).replace(/\n/g, "<br />")}</p>
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
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { isim: true, soyisim: true, departman: true } },
    },
  })
  return NextResponse.json(announcements)
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
  const { title, content } = body

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
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

  if (emails.length === 0) {
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

  return NextResponse.json({
    ...announcement,
    _emailDelivery: emailDelivery,
  })
}
