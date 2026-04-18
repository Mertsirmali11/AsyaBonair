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

  const body = await req.json()
  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: body,
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
