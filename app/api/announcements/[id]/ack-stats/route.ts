import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const announcementId = Number.parseInt(id, 10)
  if (Number.isNaN(announcementId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, title: true },
  })
  if (!ann) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
  }

  const totalStaff = await prisma.calisan.count()

  const ackRows = await prisma.announcementAcknowledgment.findMany({
    where: { announcementId },
    include: {
      calisan: {
        select: {
          id: true,
          isim: true,
          soyisim: true,
          departman: true,
          email: true,
        },
      },
    },
    orderBy: { acknowledgedAt: "desc" },
  })

  const ackedIds = new Set(ackRows.map((r) => r.calisanId))

  const allCalisan = await prisma.calisan.findMany({
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
      email: true,
    },
    orderBy: [{ soyisim: "asc" }, { isim: "asc" }],
  })

  const notAcknowledged = allCalisan.filter((c) => !ackedIds.has(c.id))

  return NextResponse.json({
    announcementId: ann.id,
    title: ann.title,
    totalStaff,
    acknowledgedCount: ackRows.length,
    acknowledged: ackRows.map((r) => ({
      calisanId: r.calisan.id,
      isim: r.calisan.isim,
      soyisim: r.calisan.soyisim,
      departman: r.calisan.departman,
      email: r.calisan.email,
      acknowledgedAt: r.acknowledgedAt.toISOString(),
    })),
    notAcknowledged,
  })
}
