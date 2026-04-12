import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageSupportTicketsAsAdmin } from "@/lib/support-ticket-access"

export const runtime = "nodejs"

const ticketSelect = {
  id: true,
  subject: true,
  content: true,
  status: true,
  adminAction: true,
  departmentSnapshot: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  lastUpdatedBy: true,
  creator: {
    select: {
      id: true,
      isim: true,
      soyisim: true,
      email: true,
      departman: true,
    },
  },
} as const

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const email = (session.user.email ?? "").trim()
    const calisan = email
      ? await prisma.calisan.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, departman: true },
        })
      : null
    if (!calisan) {
      return NextResponse.json({ error: "Employee not found" }, { status: 403 })
    }

    const isAdmin = canManageSupportTicketsAsAdmin(calisan.departman)

    const tickets = await prisma.supportTicket.findMany({
      where: isAdmin ? {} : { createdBy: calisan.id },
      orderBy: { createdAt: "desc" },
      select: ticketSelect,
    })

    return NextResponse.json({
      tickets,
      isAdmin,
    })
  } catch (e) {
    console.error("[support-tickets] GET:", e)
    return NextResponse.json(
      { error: "Destek talepleri yüklenemedi." },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const email = (session.user.email ?? "").trim()
    const calisan = email
      ? await prisma.calisan.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, departman: true },
        })
      : null
    if (!calisan) {
      return NextResponse.json({ error: "Employee not found" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as {
      subject?: unknown
      content?: unknown
    } | null
    const content =
      typeof body?.content === "string" ? body.content.trim() : ""
    const subject =
      typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : ""

    if (!content) {
      return NextResponse.json(
        { error: "Açıklama (içerik) gerekli." },
        { status: 400 }
      )
    }
    if (content.length > 16000) {
      return NextResponse.json(
        { error: "Açıklama en fazla 16000 karakter olabilir." },
        { status: 400 }
      )
    }

    const row = await prisma.supportTicket.create({
      data: {
        content,
        subject: subject || null,
        departmentSnapshot: (calisan.departman ?? "").trim() || null,
        createdBy: calisan.id,
      },
      select: {
        id: true,
        subject: true,
        content: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json(row)
  } catch (e) {
    console.error("[support-tickets] POST:", e)
    return NextResponse.json({ error: "Talep oluşturulamadı." }, { status: 500 })
  }
}
