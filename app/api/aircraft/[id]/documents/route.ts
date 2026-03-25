import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { uploadAircraftManualPdf } from "@/lib/aircraft-manuals-storage"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function GET(
  _request: Request,
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
    if (isNaN(aircraftId)) {
      return NextResponse.json({ error: "Invalid aircraft id" }, { status: 400 })
    }

    const aircraft = await prisma.ucaklar.findUnique({
      where: { id: aircraftId },
    })
    if (!aircraft) {
      return NextResponse.json({ error: "Aircraft not found" }, { status: 404 })
    }

    const rows = await prisma.aircraftDocument.findMany({
      where: { aircraftId },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: { select: { isim: true, soyisim: true } },
      },
    })

    const attachments = rows.map((d) => ({
      id: d.id,
      category: d.category,
      docType: d.docType,
      fileName: d.fileName,
      filePath: `/api/aircraft/documents/${d.id}/file`,
      fileSize: d.fileSize,
      validFrom: d.validFrom ? d.validFrom.toISOString() : null,
      validUntil: d.validUntil ? d.validUntil.toISOString() : null,
      isArchived: d.isArchived,
      createdAt: d.createdAt.toISOString(),
      uploader: d.uploader,
    }))

    return NextResponse.json(attachments)
  } catch (e) {
    console.error("GET aircraft documents:", e)
    return NextResponse.json(
      { error: "Could not load documents" },
      { status: 500 }
    )
  }
}

export async function POST(
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
    if (isNaN(aircraftId)) {
      return NextResponse.json({ error: "Invalid aircraft id" }, { status: 400 })
    }

    const aircraft = await prisma.ucaklar.findUnique({
      where: { id: aircraftId },
    })
    if (!aircraft) {
      return NextResponse.json({ error: "Aircraft not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const category = (formData.get("category") as string) || ""
    const docType = (formData.get("docType") as string) || ""
    const validFromStr = formData.get("validFrom") as string | null
    const validUntilStr = formData.get("validUntil") as string | null
    const uploadedByStr = formData.get("uploadedBy") as string | null

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
    }
    if (category !== "certificate" && category !== "manual") {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    if (!docType.trim()) {
      return NextResponse.json({ error: "Document type is required" }, { status: 400 })
    }

    const upload = await uploadAircraftManualPdf(
      file,
      aircraft.register,
      category
    )
    if (!upload) {
      return NextResponse.json(
        { error: "Upload failed (PDF only, max 50MB)" },
        { status: 400 }
      )
    }

    const validFrom =
      validFromStr && validFromStr.trim()
        ? new Date(validFromStr + "T12:00:00")
        : null
    const validUntil =
      validUntilStr && validUntilStr.trim()
        ? new Date(validUntilStr + "T12:00:00")
        : null
    let uploadedBy: number | null = null
    if (uploadedByStr) {
      const u = parseInt(uploadedByStr, 10)
      if (!Number.isNaN(u)) uploadedBy = u
    }

    const created = await prisma.aircraftDocument.create({
      data: {
        aircraftId,
        category,
        docType: docType.trim(),
        fileName: upload.fileName,
        storagePath: upload.path,
        fileSize: file.size,
        validFrom,
        validUntil,
        isArchived: false,
        uploadedBy,
      },
      include: {
        uploader: { select: { isim: true, soyisim: true } },
      },
    })

    return NextResponse.json(
      {
        id: created.id,
        category: created.category,
        docType: created.docType,
        fileName: created.fileName,
        filePath: `/api/aircraft/documents/${created.id}/file`,
        fileSize: created.fileSize,
        validFrom: created.validFrom ? created.validFrom.toISOString() : null,
        validUntil: created.validUntil ? created.validUntil.toISOString() : null,
        isArchived: created.isArchived,
        createdAt: created.createdAt.toISOString(),
        uploader: created.uploader,
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST aircraft documents:", e)
    return NextResponse.json(
      { error: "Could not upload document" },
      { status: 500 }
    )
  }
}
