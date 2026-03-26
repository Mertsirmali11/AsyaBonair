import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const meeting = await prisma.meeting.update({
    where: { id: parseInt(id) },
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
