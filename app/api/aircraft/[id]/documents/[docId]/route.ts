import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { deleteAircraftManualFile } from "@/lib/aircraft-manuals-storage"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return forbidden()
    }

    const { id, docId } = await params
    const aircraftId = parseInt(id, 10)
    const documentId = parseInt(docId, 10)
    if (isNaN(aircraftId) || isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const isArchived = Boolean(body.isArchived)

    const existing = await prisma.aircraftDocument.findFirst({
      where: { id: documentId, aircraftId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.aircraftDocument.update({
      where: { id: documentId },
      data: { isArchived },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("PATCH aircraft document:", e)
    return NextResponse.json(
      { error: "Could not update document" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return forbidden()
    }

    const { id, docId } = await params
    const aircraftId = parseInt(id, 10)
    const documentId = parseInt(docId, 10)
    if (isNaN(aircraftId) || isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = await prisma.aircraftDocument.findFirst({
      where: { id: documentId, aircraftId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await deleteAircraftManualFile(existing.storagePath)
    await prisma.aircraftDocument.delete({
      where: { id: documentId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE aircraft document:", e)
    return NextResponse.json(
      { error: "Could not delete document" },
      { status: 500 }
    )
  }
}
