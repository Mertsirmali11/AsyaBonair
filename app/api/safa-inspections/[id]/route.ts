import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageSafa } from "@/lib/safa-access"

export const runtime = "nodejs"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageSafa()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.safaInspection.findUnique({ where: { id: numericId } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    inspectionDate?: string
    location?: string
    authority?: string
    aircraftRegistration?: string
    cat1Count?: number
    cat2Count?: number
    cat3Count?: number
    notes?: string | null
  } | null
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const data: {
    inspectionDate?: Date
    location?: string
    authority?: string
    aircraftRegistration?: string
    cat1Count?: number
    cat2Count?: number
    cat3Count?: number
    notes?: string | null
  } = {}

  if ("inspectionDate" in body) {
    const d = new Date(String(body.inspectionDate ?? ""))
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Denetim tarihi geçersiz." }, { status: 400 })
    }
    data.inspectionDate = d
  }
  if ("location" in body) {
    const v = String(body.location ?? "").trim()
    if (!v) return NextResponse.json({ error: "Denetim yeri gerekli." }, { status: 400 })
    data.location = v
  }
  if ("authority" in body) {
    const v = String(body.authority ?? "").trim()
    if (!v) return NextResponse.json({ error: "Otorite gerekli." }, { status: 400 })
    data.authority = v
  }
  if ("aircraftRegistration" in body) {
    const v = String(body.aircraftRegistration ?? "").trim()
    if (!v) return NextResponse.json({ error: "Uçak tescili gerekli." }, { status: 400 })
    data.aircraftRegistration = v
  }
  if ("cat1Count" in body) data.cat1Count = Math.max(0, Number(body.cat1Count) || 0)
  if ("cat2Count" in body) data.cat2Count = Math.max(0, Number(body.cat2Count) || 0)
  if ("cat3Count" in body) data.cat3Count = Math.max(0, Number(body.cat3Count) || 0)
  if ("notes" in body) data.notes = body.notes?.trim() || null

  const updated = await prisma.safaInspection.update({
    where: { id: numericId },
    data,
    select: {
      id: true,
      inspectionDate: true,
      location: true,
      authority: true,
      aircraftRegistration: true,
      cat1Count: true,
      cat2Count: true,
      cat3Count: true,
      notes: true,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageSafa()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.safaInspection.findUnique({ where: { id: numericId } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.safaInspection.delete({ where: { id: numericId } })
  return NextResponse.json({ success: true })
}
