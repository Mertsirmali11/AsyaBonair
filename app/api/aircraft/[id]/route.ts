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

    const body = (await request.json()) as Record<string, unknown>

    const data: { isArchived?: boolean; register?: string; msn?: string } = {}

    if (body.isArchived !== undefined) {
      if (typeof body.isArchived !== "boolean") {
        return NextResponse.json({ error: "isArchived must be a boolean" }, { status: 400 })
      }
      data.isArchived = body.isArchived
    }

    if (body.register !== undefined) {
      const register =
        typeof body.register === "string" ? body.register.trim() : ""
      if (!register) {
        return NextResponse.json({ error: "Register is required" }, { status: 400 })
      }
      data.register = register
    }

    if (body.msn !== undefined) {
      const msn = typeof body.msn === "string" ? body.msn.trim() : ""
      if (!msn) {
        return NextResponse.json({ error: "MSN is required" }, { status: 400 })
      }
      data.msn = msn
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const existing = await prisma.ucaklar.findUnique({ where: { id: aircraftId } })
    if (!existing) {
      return NextResponse.json({ error: "Aircraft not found" }, { status: 404 })
    }

    const updated = await prisma.ucaklar.update({
      where: { id: aircraftId },
      data,
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
