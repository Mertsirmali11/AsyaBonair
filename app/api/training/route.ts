import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { assertCanManageTraining } from "@/lib/training-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const trainingSelect = {
  id: true,
  calisanId: true,
  trainingName: true,
  completionDate: true,
  expiryDate: true,
  certificateStoragePath: true,
  certificateFileName: true,
  notes: true,
  createdAt: true,
  calisan: {
    select: { id: true, isim: true, soyisim: true, departman: true },
  },
} as const

export async function GET(req: NextRequest) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const calisanIdParam = req.nextUrl.searchParams.get("calisanId")
  const calisanId = calisanIdParam ? Number.parseInt(calisanIdParam, 10) : null

  const records = await prisma.trainingRecord.findMany({
    where: calisanId && Number.isInteger(calisanId) ? { calisanId } : {},
    orderBy: [{ expiryDate: "asc" }, { completionDate: "desc" }],
    select: trainingSelect,
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const session = await auth()
  const creator = session?.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null

  const body = (await req.json().catch(() => null)) as {
    calisanId?: number
    trainingName?: string
    completionDate?: string
    expiryDate?: string | null
    notes?: string | null
    certificate?: { path: string; fileName: string } | null
  } | null
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const calisanId = Number(body.calisanId)
  const trainingName = String(body.trainingName ?? "").trim()
  const completionDateStr = String(body.completionDate ?? "").trim()

  if (!Number.isInteger(calisanId) || calisanId < 1) {
    return NextResponse.json({ error: "Personel seçin." }, { status: 400 })
  }
  if (!trainingName) {
    return NextResponse.json({ error: "Eğitim adı gerekli." }, { status: 400 })
  }
  const completionDate = new Date(completionDateStr)
  if (Number.isNaN(completionDate.getTime())) {
    return NextResponse.json({ error: "Tamamlanma tarihi geçersiz." }, { status: 400 })
  }

  let expiryDate: Date | null = null
  if (body.expiryDate) {
    const parsed = new Date(body.expiryDate)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Geçerlilik tarihi geçersiz." }, { status: 400 })
    }
    expiryDate = parsed
  }

  const employee = await prisma.calisan.findUnique({ where: { id: calisanId }, select: { id: true } })
  if (!employee) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 })
  }

  const record = await prisma.trainingRecord.create({
    data: {
      calisanId,
      trainingName,
      completionDate,
      expiryDate,
      notes: body.notes?.trim() || null,
      certificateStoragePath: body.certificate?.path ?? null,
      certificateFileName: body.certificate?.fileName ?? null,
      createdBy: creator?.id ?? null,
    },
    select: trainingSelect,
  })

  return NextResponse.json(record, { status: 201 })
}
