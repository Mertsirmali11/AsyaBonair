import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { downloadAircraftManualFile } from "@/lib/aircraft-manuals-storage"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { docId } = await params
    const id = parseInt(docId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
    }

    const doc = await prisma.aircraftDocument.findUnique({
      where: { id },
    })

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await downloadAircraftManualFile(doc.storagePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      )
    }

    const safeName = doc.fileName.replace(/[\r\n"]/g, "_")

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e) {
    console.error("GET aircraft document file:", e)
    return NextResponse.json(
      { error: "Could not serve file" },
      { status: 500 }
    )
  }
}
