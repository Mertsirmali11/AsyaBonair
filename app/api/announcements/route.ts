import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

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

  // Tüm çalışanlara mail gönder
  const calisanlar = await prisma.calisan.findMany({
    select: { email: true },
  })

  const emails = calisanlar.map(c => c.email).filter(Boolean)

  if (emails.length > 0) {
    await resend.emails.send({
      from: "Bonair <onboarding@resend.dev>",
      to: emails,
      subject: `📢 Yeni Duyuru: ${title}`,
      html: `
        <h2>${title}</h2>
        <p>${content}</p>
        <hr />
        <small>Bu duyuru Bonair SMS sistemi tarafından gönderilmiştir.</small>
      `,
    })
  }

  return NextResponse.json(announcement)
}
