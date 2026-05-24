import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { isAdminDepartment } from "@/lib/department-access"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const meetingId = parseInt(id, 10)

  // Find current user's calisan record
  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  const isAdmin = isAdminDepartment(session.user.departman)

  if (!isAdmin) {
    // Non-admin: must be a participant
    const participation = calisan
      ? await prisma.meetingParticipant.findFirst({
          where: { meetingId, calisanId: calisan.id },
          select: { id: true },
        })
      : null

    if (!participation) {
      return NextResponse.json({ error: "Forbidden — only meeting participants can edit." }, { status: 403 })
    }
  }

  const body = await req.json() as Record<string, unknown>

  // Build a strict update payload — only known fields (prevents arbitrary field injection)
  const data: Record<string, unknown> = {}
  if ("title" in body)              data.title           = body.title
  if ("status" in body)             data.status          = body.status
  if ("actualDate" in body)         data.actualDate      = body.actualDate ? new Date(body.actualDate as string) : null
  if ("meetingMinutes" in body)     data.meetingMinutes  = body.meetingMinutes
  if ("agenda" in body)             data.agenda          = body.agenda
  if ("meetingTime" in body)        data.meetingTime     = body.meetingTime
  if ("location" in body)           data.location        = body.location
  if ("compiledBy" in body)         data.compiledBy      = body.compiledBy

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data,
  })
  return NextResponse.json(prismaJson(meeting))
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(id) },
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true, departman: true, email: true } } },
      },
    },
  })
  return NextResponse.json(prismaJson(meeting))
}
