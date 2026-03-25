import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { Resend } from "resend"

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
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

  const emails = calisanlar.map(c => c.email).filter(Boolean)

  const resend = getResend()
  if (emails.length > 0 && resend) {
    await resend.emails.send({
      from: "Bonair <onboarding@resend.dev>",
      to: emails,
      subject: `📢 New announcement: ${title}`,
      html: `
        <h2>${title}</h2>
        <p>${content}</p>
        <hr />
        <small>Sent by the Bonair SMS portal.</small>
      `,
    })
  }

  return NextResponse.json(announcement)
}
