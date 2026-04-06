import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  ALLOWED_DOCUMENTS_ERROR_EN,
  isAllowedCorrespondenceDocumentFile,
} from "@/lib/allowed-document-uploads"
import {
  assignUniquePdfStorageNames,
  INCOMING_PDF_MAX_TOTAL_BYTES,
  type IncomingStoredAttachment,
} from "@/lib/incoming-correspondence-attachments"
import { setIncomingPdfAttachmentsJsonb } from "@/lib/persist-correspondence-pdf-jsonb"
import { deletePdfFromStorage, uploadPdfToStorage } from "@/lib/supabase-storage"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const papers = await prisma.incomingPaper.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
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

    return NextResponse.json(papers)
  } catch (error) {
    console.error("Error fetching incoming correspondences:", error)
    return NextResponse.json(
      { error: "Could not fetch incoming correspondences" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()

    const from = formData.get("from") as string
    const subject = formData.get("subject") as string
    const dateStr = formData.get("date") as string
    const content = formData.get("content") as string
    const createdBy = formData.get("createdBy") as string
    const pdfFiles = formData
      .getAll("pdf")
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (!from || !subject || !dateStr) {
      return NextResponse.json(
        { error: "From, Subject, and Date are required" },
        { status: 400 }
      )
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    const lastPaper = await prisma.incomingPaper.findFirst({
      orderBy: { id: "desc" },
      select: { paperNo: true },
    })

    let paperNo: string
    if (lastPaper && lastPaper.paperNo) {
      const match = lastPaper.paperNo.match(/BON-IP-(\d+)/)
      if (match) {
        const lastNumber = parseInt(match[1])
        const nextNumber = lastNumber + 1
        paperNo = `BON-IP-${String(nextNumber).padStart(3, "0")}`
      } else {
        paperNo = "BON-IP-001"
      }
    } else {
      paperNo = "BON-IP-001"
    }

    let pdfPath: string | null = null
    let pdfFileName: string | null = null
    let pdfAttachments: IncomingStoredAttachment[] | null = null

    if (pdfFiles.length > 0) {
      const totalBytes = pdfFiles.reduce((s, f) => s + f.size, 0)
      if (totalBytes > INCOMING_PDF_MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total attachment size must not exceed 50MB" },
          { status: 400 }
        )
      }
      for (const f of pdfFiles) {
        if (!isAllowedCorrespondenceDocumentFile(f)) {
          return NextResponse.json({ error: ALLOWED_DOCUMENTS_ERROR_EN }, { status: 400 })
        }
      }

      const storageNames = assignUniquePdfStorageNames(pdfFiles)
      const uploaded: IncomingStoredAttachment[] = []

      try {
        for (let i = 0; i < pdfFiles.length; i++) {
          const uploadResult = await uploadPdfToStorage(pdfFiles[i], paperNo, {
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
      } catch (fileError: unknown) {
        console.error("File upload error:", fileError)
        const msg = fileError instanceof Error ? fileError.message : "Unknown error"
        return NextResponse.json(
          { error: `File upload failed: ${msg}` },
          { status: 500 }
        )
      }

      pdfAttachments = uploaded
      pdfPath = uploaded[0]?.path ?? null
      pdfFileName = uploaded[0]?.fileName ?? null
    }

    const paper = await prisma.incomingPaper.create({
      data: {
        paperNo: paperNo,
        from: from,
        subject: subject,
        date: date,
        content: content || null,
        pdfPath: pdfPath,
        pdfFileName: pdfFileName,
        createdBy: createdBy ? parseInt(createdBy) : null,
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

    if (pdfAttachments?.length) {
      await setIncomingPdfAttachmentsJsonb(paper.id, pdfAttachments)
    }

    const full = await prisma.incomingPaper.findUnique({
      where: { id: paper.id },
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

    return NextResponse.json(full ?? paper, { status: 201 })
  } catch (error: unknown) {
    console.error("Error creating incoming correspondence:", error)
    const err = error as { message?: string; code?: string; name?: string; stack?: string }
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    })

    if (err.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid creator ID" },
        { status: 400 }
      )
    }

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Paper number already exists" },
        { status: 400 }
      )
    }

    const errorMessage = process.env.NODE_ENV === "development"
      ? err.message || "Could not create incoming correspondence"
      : "Could not create incoming correspondence"

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
