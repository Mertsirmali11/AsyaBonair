import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"
import { prismaJson } from "@/lib/prisma-json"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = body as { title?: unknown; content?: unknown; isActive?: unknown }
  const title =
    typeof raw.title === "string" ? raw.title.trim() : ""
  const content =
    typeof raw.content === "string" ? raw.content.trim() : ""
  const nextActive = typeof raw.isActive === "boolean" ? raw.isActive : null
  /** Sadece durum değişimi: gövde/başlık yok veya boş (null/"" ile gelen isteklerde de çalışır). */
  const hasFullText = Boolean(title && content)
  const statusOnly = nextActive !== null && !hasFullText

  function prismaErrorResponse(e: unknown, label: string) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.error(label, e)
    const isDev = process.env.NODE_ENV === "development"
    return NextResponse.json(
      {
        error: "Could not update announcement",
        ...(isDev ? { detail: msg } : {}),
      },
      { status: 500 }
    )
  }

  if (statusOnly) {
    try {
      const updated = await prisma.announcement.update({
        where: { id: numericId },
        data: { isActive: nextActive },
        include: {
          creator: { select: { isim: true, soyisim: true, departman: true } },
        },
      })
      const totalStaff = await prisma.calisan.count()
      const ackCount = await prisma.announcementAcknowledgment.count({
        where: { announcementId: numericId },
      })
      return NextResponse.json(
        prismaJson({
          ...updated,
          acknowledgedCount: ackCount,
          totalStaff,
        })
      )
    } catch (e: unknown) {
      return prismaErrorResponse(e, "PATCH announcement (isActive):")
    }
  }

  if (!hasFullText) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    )
  }

  try {
    const data: { title: string; content: string; isActive?: boolean } = {
      title,
      content,
    }
    if (nextActive !== null) {
      data.isActive = nextActive
    }
    const updated = await prisma.announcement.update({
      where: { id: numericId },
      data,
      include: {
        creator: { select: { isim: true, soyisim: true, departman: true } },
      },
    })
    const totalStaff = await prisma.calisan.count()
    const ackCount = await prisma.announcementAcknowledgment.count({
      where: { announcementId: numericId },
    })
    return NextResponse.json(
      prismaJson({
        ...updated,
        acknowledgedCount: ackCount,
        totalStaff,
      })
    )
  } catch (e: unknown) {
    return prismaErrorResponse(e, "PATCH announcement:")
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    await prisma.announcement.delete({
      where: { id: numericId },
    })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    console.error("DELETE announcement:", e)
    return NextResponse.json({ error: "Could not delete announcement" }, { status: 500 })
  }
}
