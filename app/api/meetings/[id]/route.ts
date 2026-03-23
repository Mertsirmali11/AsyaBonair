import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const meeting = await prisma.meeting.update({
    where: { id: parseInt(params.id) },
    data: body,
  })
  return NextResponse.json(meeting)
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true, departman: true, email: true } } },
      },
    },
  })
  return NextResponse.json(meeting)
}
