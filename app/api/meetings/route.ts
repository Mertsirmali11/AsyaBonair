import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get("year")

  const where = year && year !== "All"
    ? {
        plannedDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      }
    : {}

  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true } } },
      },
    },
    orderBy: { plannedDate: "desc" },
  })

  return NextResponse.json(meetings)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, plannedDate, meetingTypeId, participantIds, isOnline, agenda } = body

  // Boşlukları doldur mantığı
  const existing = await prisma.meeting.findMany({
    select: { meetingNo: true },
    orderBy: { id: "asc" },
  })

  const usedNumbers = existing
    .map(m => parseInt(m.meetingNo?.replace("BON-ME-", "") ?? "0"))
    .filter(n => !isNaN(n))

  let nextNo = 1
  while (usedNumbers.includes(nextNo)) {
    nextNo++
  }

  const meetingNo = `BON-ME-${String(nextNo).padStart(3, "0")}`

  const meeting = await prisma.meeting.create({
    data: {
      meetingNo,
      title,
      plannedDate: new Date(plannedDate),
      initializedDate: new Date(),
      isOnline: isOnline ?? false,
      agenda,
      meetingTypeId: meetingTypeId ? parseInt(meetingTypeId) : null,
      status: "Planned",
      participants: {
        create: participantIds.map((id: number) => ({ calisanId: id })),
      },
    },
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true } } },
      },
    },
  })

  return NextResponse.json(meeting)
}
