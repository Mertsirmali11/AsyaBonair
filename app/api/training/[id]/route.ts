import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageTraining } from "@/lib/training-access"
import { deletePdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.trainingRecord.findUnique({ where: { id: numericId } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    trainingName?: string
    completionDate?: string
    expiryDate?: string | null
    notes?: string | null
    certificate?: { path: string; fileName: string } | null
  } | null
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const data: {
    trainingName?: string
    completionDate?: Date
    expiryDate?: Date | null
    notes?: string | null
    certificateStoragePath?: string | null
    certificateFileName?: string | null
  } = {}

  if ("trainingName" in body) {
    const name = String(body.trainingName ?? "").trim()
    if (!name) return NextResponse.json({ error: "Eğitim adı gerekli." }, { status: 400 })
    data.trainingName = name
  }
  if ("completionDate" in body) {
    const d = new Date(String(body.completionDate ?? ""))
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Tamamlanma tarihi geçersiz." }, { status: 400 })
    }
    data.completionDate = d
  }
  if ("expiryDate" in body) {
    if (!body.expiryDate) {
      data.expiryDate = null
    } else {
      const d = new Date(body.expiryDate)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Geçerlilik tarihi geçersiz." }, { status: 400 })
      }
      data.expiryDate = d
    }
  }
  if ("notes" in body) {
    data.notes = body.notes?.trim() || null
  }
  if ("certificate" in body) {
    // Yeni sertifika yüklendi — eskisini depodan sil.
    if (existing.certificateStoragePath) {
      await deletePdfFromStorage(existing.certificateStoragePath)
    }
    data.certificateStoragePath = body.certificate?.path ?? null
    data.certificateFileName = body.certificate?.fileName ?? null
  }

  const updated = await prisma.trainingRecord.update({
    where: { id: numericId },
    data,
    select: {
      id: true,
      calisanId: true,
      trainingName: true,
      completionDate: true,
      expiryDate: true,
      certificateStoragePath: true,
      certificateFileName: true,
      notes: true,
      calisan: { select: { id: true, isim: true, soyisim: true, departman: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.trainingRecord.findUnique({ where: { id: numericId } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (existing.certificateStoragePath) {
    await deletePdfFromStorage(existing.certificateStoragePath)
  }

  await prisma.trainingRecord.delete({ where: { id: numericId } })
  return NextResponse.json({ success: true })
}
