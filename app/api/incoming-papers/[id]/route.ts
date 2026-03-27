import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
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

  const existing = await prisma.incomingPaper.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!existing.paperNo) {
    return NextResponse.json({ error: "Record has no paper number" }, { status: 400 })
  }

  const formData = await request.formData()
  const from = String(formData.get("from") ?? "").trim()
  const subject = String(formData.get("subject") ?? "").trim()
  const dateStr = String(formData.get("date") ?? "").trim()
  const content = String(formData.get("content") ?? "")
  const pdfFile = formData.get("pdf") as File | null

  if (!from || !subject || !dateStr) {
    return NextResponse.json(
      { error: "From, Subject, and Date are required" },
      { status: 400 }
    )
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  let pdfPath: string | null = existing.pdfPath
  let pdfFileName: string | null = existing.pdfFileName

  if (pdfFile && pdfFile.size > 0) {
    const maxSize = 50 * 1024 * 1024
    if (pdfFile.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      )
    }
    if (pdfFile.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      )
    }
    if (existing.pdfPath) {
      await deletePdfFromStorage(existing.pdfPath)
    }
    const uploadResult = await uploadPdfToStorage(pdfFile, existing.paperNo)
    if (!uploadResult) {
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      )
    }
    pdfPath = uploadResult.path
    pdfFileName = uploadResult.fileName
  }

  try {
    const paper = await prisma.incomingPaper.update({
      where: { id },
      data: {
        from,
        subject,
        date,
        content: content.trim() || null,
        pdfPath,
        pdfFileName,
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
    return NextResponse.json(paper)
  } catch (e) {
    console.error("PATCH incoming paper:", e)
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

  const existing = await prisma.incomingPaper.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (existing.pdfPath) {
    await deletePdfFromStorage(existing.pdfPath)
  }

  try {
    await prisma.incomingPaper.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE incoming paper:", e)
    return NextResponse.json(
      { error: "Could not delete correspondence" },
      { status: 500 }
    )
  }
}
