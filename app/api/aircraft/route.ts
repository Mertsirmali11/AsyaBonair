import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { deleteAircraftManualFile } from "@/lib/aircraft-manuals-storage"

export async function GET() {
  const aircraft = await prisma.ucaklar.findMany({
    orderBy: { register: "asc" },
  })
  return NextResponse.json(aircraft)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { register, msn } = body
  const aircraft = await prisma.ucaklar.create({
    data: { register, msn },
  })
  return NextResponse.json(aircraft)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 })
  const aircraftId = parseInt(id)
  const docs = await prisma.aircraftDocument.findMany({
    where: { aircraftId },
    select: { storagePath: true },
  })
  for (const d of docs) {
    await deleteAircraftManualFile(d.storagePath)
  }
  await prisma.ucaklar.delete({ where: { id: aircraftId } })
  return NextResponse.json({ success: true })
}