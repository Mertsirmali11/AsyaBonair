import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { assertCanManageSafa } from "@/lib/safa-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const safaSelect = {
  id: true,
  inspectionDate: true,
  location: true,
  authority: true,
  aircraftRegistration: true,
  cat1Count: true,
  cat2Count: true,
  cat3Count: true,
  notes: true,
  createdAt: true,
} as const

export async function GET(req: NextRequest) {
  const gate = await assertCanManageSafa()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const from = sp.get("from")
  const to = sp.get("to")
  const registration = sp.get("registration")?.trim()
  const authority = sp.get("authority")?.trim()

  const where: {
    inspectionDate?: { gte?: Date; lte?: Date }
    aircraftRegistration?: { contains: string; mode: "insensitive" }
    authority?: { contains: string; mode: "insensitive" }
  } = {}

  if (from || to) {
    where.inspectionDate = {}
    if (from) {
      const d = new Date(from)
      if (!Number.isNaN(d.getTime())) where.inspectionDate.gte = d
    }
    if (to) {
      const d = new Date(to)
      if (!Number.isNaN(d.getTime())) where.inspectionDate.lte = d
    }
  }
  if (registration) {
    where.aircraftRegistration = { contains: registration, mode: "insensitive" }
  }
  if (authority) {
    where.authority = { contains: authority, mode: "insensitive" }
  }

  const records = await prisma.safaInspection.findMany({
    where,
    orderBy: { inspectionDate: "desc" },
    select: safaSelect,
    take: 500,
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const gate = await assertCanManageSafa()
  if (!gate.ok) return gate.response

  const session = await auth()
  const creator = session?.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null

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

  const inspectionDate = new Date(String(body.inspectionDate ?? ""))
  const location = String(body.location ?? "").trim()
  const authority = String(body.authority ?? "").trim()
  const aircraftRegistration = String(body.aircraftRegistration ?? "").trim()
  const cat1Count = Math.max(0, Number(body.cat1Count) || 0)
  const cat2Count = Math.max(0, Number(body.cat2Count) || 0)
  const cat3Count = Math.max(0, Number(body.cat3Count) || 0)

  if (Number.isNaN(inspectionDate.getTime())) {
    return NextResponse.json({ error: "Denetim tarihi geçersiz." }, { status: 400 })
  }
  if (!location) {
    return NextResponse.json({ error: "Denetim yeri / havalimanı gerekli." }, { status: 400 })
  }
  if (!authority) {
    return NextResponse.json({ error: "Denetleyen otorite gerekli." }, { status: 400 })
  }
  if (!aircraftRegistration) {
    return NextResponse.json({ error: "Uçak tescili gerekli." }, { status: 400 })
  }

  const record = await prisma.safaInspection.create({
    data: {
      inspectionDate,
      location,
      authority,
      aircraftRegistration,
      cat1Count,
      cat2Count,
      cat3Count,
      notes: body.notes?.trim() || null,
      createdBy: creator?.id ?? null,
    },
    select: safaSelect,
  })

  return NextResponse.json(record, { status: 201 })
}
