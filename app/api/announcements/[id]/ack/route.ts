import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const announcementId = Number.parseInt(id, 10)
    if (Number.isNaN(announcementId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!calisan) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 403 })
    }

    const exists = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    await prisma.announcementAcknowledgment.upsert({
      where: {
        announcementId_calisanId: {
          announcementId,
          calisanId: calisan.id,
        },
      },
      create: { announcementId, calisanId: calisan.id },
      update: { acknowledgedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("POST /api/announcements/[id]/ack:", e)
    return NextResponse.json({ error: "Could not save acknowledgment" }, { status: 500 })
  }
}
