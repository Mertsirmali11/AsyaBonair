import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  assignUniquePdfStorageNames,
  getOutgoingAttachmentsFromRow,
  OUTGOING_PDF_MAX_TOTAL_BYTES,
  type OutgoingStoredAttachment,
} from "@/lib/outgoing-correspondence-attachments"
import {
  deletePdfFromStorage,
  uploadPdfToStorage,
} from "@/lib/supabase-storage"

async function gate() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { id: idParam } = await params
  const id = Number.parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.outgoingCorrespondence.findUnique({
    where: { id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!existing.paperNo) {
    return NextResponse.json({ error: "Record has no paper number" }, { status: 400 })
  }

  const formData = await request.formData()
  const to = String(formData.get("to") ?? "").trim()
  const subject = String(formData.get("subject") ?? "").trim()
  const dateStr = String(formData.get("date") ?? "").trim()
  const content = String(formData.get("content") ?? "")
  const pdfFiles = formData
    .getAll("pdf")
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (!to || !subject || !dateStr) {
    return NextResponse.json(
      { error: "To, Subject, and Date are required" },
      { status: 400 }
    )
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  const storagePrefix = `outgoing/${existing.paperNo}`
  let pdfPath: string | null = existing.pdfPath
  let pdfFileName: string | null = existing.pdfFileName
  let pdfAttachments: OutgoingStoredAttachment[] | null | undefined = undefined

  if (pdfFiles.length > 0) {
    const totalBytes = pdfFiles.reduce((s, f) => s + f.size, 0)
    if (totalBytes > OUTGOING_PDF_MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Total attachment size must not exceed 50MB" },
        { status: 400 }
      )
    }
    for (const f of pdfFiles) {
      if (f.type !== "application/pdf") {
        return NextResponse.json(
          { error: "Only PDF files are allowed" },
          { status: 400 }
        )
      }
    }

    const previous = getOutgoingAttachmentsFromRow(existing)
    for (const a of previous) {
      await deletePdfFromStorage(a.path)
    }

    const storageNames = assignUniquePdfStorageNames(pdfFiles)
    const uploaded: OutgoingStoredAttachment[] = []
    for (let i = 0; i < pdfFiles.length; i++) {
      const uploadResult = await uploadPdfToStorage(pdfFiles[i], storagePrefix, {
        storageFileName: storageNames[i],
      })
      if (!uploadResult.ok) {
        for (const a of uploaded) {
          await deletePdfFromStorage(a.path)
        }
        return NextResponse.json(
          {
            error: `Dosya yüklenemedi (${pdfFiles[i].name}): ${uploadResult.message}`,
          },
          { status: 500 }
        )
      }
      uploaded.push({ path: uploadResult.path, fileName: uploadResult.fileName })
    }
    pdfAttachments = uploaded
    pdfPath = uploaded[0]?.path ?? null
    pdfFileName = uploaded[0]?.fileName ?? null
  }

  try {
    const correspondence = await prisma.outgoingCorrespondence.update({
      where: { id },
      data: {
        to,
        subject,
        date,
        content: content.trim() || null,
        pdfPath,
        pdfFileName,
        ...(pdfAttachments !== undefined
          ? {
              pdfAttachments:
                pdfAttachments.length > 0
                  ? (pdfAttachments as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            isim: true,
            soyisim: true,
            email: true,
            departman: true,
          },
        },
      },
    })

    return NextResponse.json(correspondence)
  } catch (e) {
    console.error("PATCH outgoing correspondence:", e)
    return NextResponse.json(
      { error: "Could not update correspondence" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { id: idParam } = await params
  const id = Number.parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.outgoingCorrespondence.findUnique({
    where: { id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const toRemove = getOutgoingAttachmentsFromRow(existing)
  for (const a of toRemove) {
    await deletePdfFromStorage(a.path)
  }

  try {
    await prisma.outgoingCorrespondence.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE outgoing correspondence:", e)
    return NextResponse.json(
      { error: "Could not delete correspondence" },
      { status: 500 }
    )
  }
}
