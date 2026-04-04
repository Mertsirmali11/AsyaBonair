import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canAccessConfigurationsArea } from "@/lib/department-access"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return forbidden()
    }

    const { id } = await params
    const aircraftId = parseInt(id, 10)
    if (Number.isNaN(aircraftId)) {
      return NextResponse.json({ error: "Invalid aircraft id" }, { status: 400 })
    }

    const body = await request.json()
    if (typeof body.isArchived !== "boolean") {
      return NextResponse.json({ error: "isArchived boolean required" }, { status: 400 })
    }

    const existing = await prisma.ucaklar.findUnique({ where: { id: aircraftId } })
    if (!existing) {
      return NextResponse.json({ error: "Aircraft not found" }, { status: 404 })
    }

    const updated = await prisma.ucaklar.update({
      where: { id: aircraftId },
      data: { isArchived: body.isArchived },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error("PATCH aircraft:", e)
    return NextResponse.json(
      { error: "Could not update aircraft" },
      { status: 500 }
    )
  }
}
