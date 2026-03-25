import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { allocateMeetingNo } from "@/lib/meeting-number"

/** Align with dashboard "today" filters: DATE-only from yyyy-mm-dd as UTC midnight. */
function parsePlannedDateInput(isoDateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDateStr.trim())
  if (!m) return new Date(isoDateStr)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get("year")

    const where =
      year && year !== "All"
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

    return NextResponse.json(prismaJson(meetings))
  } catch (e) {
    console.error("[GET /api/meetings]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Meetings could not be loaded" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, plannedDate, meetingTypeId, participantIds, isOnline, agenda } = body

    if (
      meetingTypeId === undefined ||
      meetingTypeId === null ||
      meetingTypeId === ""
    ) {
      return NextResponse.json(
        { error: "Meeting type is required" },
        { status: 400 }
      )
    }

    const typeId = BigInt(meetingTypeId)
    const planned = parsePlannedDateInput(String(plannedDate))

    const maxAttempts = 8
    let lastError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const meetingNo = await allocateMeetingNo(prisma, typeId, planned)
      try {
        const meeting = await prisma.meeting.create({
          data: {
            meetingNo,
            title,
            plannedDate: planned,
            initializedDate: new Date(),
            isOnline: isOnline ?? false,
            agenda,
            meetingTypeId: typeId,
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
        return NextResponse.json(prismaJson(meeting))
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue
        }
        throw e
      }
    }
    console.error("[POST /api/meetings] meetingNo collision after retries", lastError)
    return NextResponse.json(
      { error: "Could not assign a unique meeting number" },
      { status: 409 }
    )
  } catch (e) {
    console.error("[POST /api/meetings]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Meeting could not be created" },
      { status: 500 }
    )
  }
}
