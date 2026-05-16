import { NextRequest, NextResponse } from "next/server"
import { SupportTicketStatus } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageSupportTicketsAsAdmin } from "@/lib/support-ticket-access"

export const runtime = "nodejs"

function isMissingTableError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const code = "code" in e ? (e as { code?: unknown }).code : undefined
  return code === "P2021"
}

const STATUSES = new Set<string>(Object.values(SupportTicketStatus))

const attachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
} as const

const historySelect = {
  id: true,
  createdAt: true,
  eventType: true,
  statusFrom: true,
  statusTo: true,
  adminNote: true,
  subjectSnapshot: true,
  contentSnapshot: true,
  attachmentMeta: true,
  actor: {
    select: {
      id: true,
      isim: true,
      soyisim: true,
      email: true,
      departman: true,
    },
  },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const numericId = Number.parseInt(id, 10)
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: numericId },
      select: {
        id: true,
        createdBy: true,
        subject: true,
        content: true,
        status: true,
        adminAction: true,
        departmentSnapshot: true,
        createdAt: true,
        updatedAt: true,
        attachments: { select: attachmentSelect, orderBy: { id: "asc" as const } },
        creator: {
          select: {
            id: true,
            isim: true,
            soyisim: true,
            email: true,
            departman: true,
          },
        },
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    }

    const isAdmin = canManageSupportTicketsAsAdmin(calisan.departman)
    if (!isAdmin && ticket.createdBy !== calisan.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let history: unknown[] = []
    try {
      history = await prisma.supportTicketHistory.findMany({
        where: { supportTicketId: numericId },
        orderBy: { createdAt: "asc" },
        select: historySelect,
      })
    } catch (e) {
      if (!isMissingTableError(e)) throw e
      history = []
    }

    return NextResponse.json({ ticket, history })
  } catch (e) {
    console.error("[support-tickets] GET [id]:", e)
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!canManageSupportTicketsAsAdmin(calisan.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const numericId = Number.parseInt(id, 10)
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as {
      status?: unknown
      adminAction?: unknown
    } | null

    const statusRaw = body?.status
    const adminActionRaw = body?.adminAction

    if (statusRaw === undefined && adminActionRaw === undefined) {
      return NextResponse.json(
        { error: "Durum veya admin aksiyonu gönderin." },
        { status: 400 }
      )
    }

    const before = await prisma.supportTicket.findUnique({
      where: { id: numericId },
      select: { status: true, adminAction: true },
    })
    if (!before) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    }

    const data: {
      status?: SupportTicketStatus
      adminAction?: string | null
      lastUpdatedBy: number
    } = { lastUpdatedBy: calisan.id }

    if (statusRaw !== undefined) {
      if (typeof statusRaw !== "string" || !STATUSES.has(statusRaw)) {
        return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 })
      }
      data.status = statusRaw as SupportTicketStatus
    }

    if (adminActionRaw !== undefined) {
      if (adminActionRaw !== null && typeof adminActionRaw !== "string") {
        return NextResponse.json({ error: "Geçersiz aksiyon metni." }, { status: 400 })
      }
      const t =
        typeof adminActionRaw === "string" ? adminActionRaw.trim().slice(0, 16000) : ""
      data.adminAction = t.length > 0 ? t : null
    }

    const nextStatus: SupportTicketStatus =
      data.status !== undefined ? data.status : before.status

    let historyNote: string | null = null
    if (adminActionRaw !== undefined) {
      if (typeof adminActionRaw === "string") {
        const t = adminActionRaw.trim().slice(0, 16000)
        historyNote = t.length > 0 ? t : null
      } else if (adminActionRaw === null) {
        historyNote = null
      }
    }

    let updated: {
      id: number
      status: SupportTicketStatus
      adminAction: string | null
      updatedAt: Date
    }
    try {
      ;[updated] = await prisma.$transaction([
        prisma.supportTicket.update({
          where: { id: numericId },
          data,
          select: {
            id: true,
            status: true,
            adminAction: true,
            updatedAt: true,
          },
        }),
        prisma.supportTicketHistory.create({
          data: {
            supportTicketId: numericId,
            actorId: calisan.id,
            eventType: "ADMIN_UPDATE",
            statusFrom: before.status,
            statusTo: nextStatus,
            adminNote: historyNote,
          },
        }),
      ])
    } catch (e) {
      if (!isMissingTableError(e)) throw e
      updated = await prisma.supportTicket.update({
        where: { id: numericId },
        data,
        select: {
          id: true,
          status: true,
          adminAction: true,
          updatedAt: true,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : ""
    if (code === "P2025") {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    }
    console.error("[support-tickets] PATCH:", e)
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
  }
}
