import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { uploadPdfToStorage } from "@/lib/supabase-storage"

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

    const correspondences = await prisma.outgoingCorrespondence.findMany({
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

    return NextResponse.json(correspondences)
  } catch (error) {
    console.error("Error fetching outgoing correspondences:", error)
    return NextResponse.json(
      { error: "Could not fetch outgoing correspondences" },
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

    const to = formData.get("to") as string
    const subject = formData.get("subject") as string
    const dateStr = formData.get("date") as string
    const content = formData.get("content") as string
    const createdBy = formData.get("createdBy") as string
    const pdfFile = formData.get("pdf") as File | null

    if (!to || !subject || !dateStr) {
      return NextResponse.json(
        { error: "To, Subject, and Date are required" },
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

    const lastCorrespondence = await prisma.outgoingCorrespondence.findFirst({
      orderBy: { id: "desc" },
      select: { paperNo: true },
    })

    let paperNo: string
    if (lastCorrespondence && lastCorrespondence.paperNo) {
      const match = lastCorrespondence.paperNo.match(/BON-OC-(\d+)/)
      if (match) {
        const lastNumber = parseInt(match[1])
        const nextNumber = lastNumber + 1
        paperNo = `BON-OC-${String(nextNumber).padStart(3, "0")}`
      } else {
        paperNo = "BON-OC-001"
      }
    } else {
      paperNo = "BON-OC-001"
    }

    let pdfPath: string | null = null
    let pdfFileName: string | null = null

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

      try {
        const uploadResult = await uploadPdfToStorage(pdfFile, `outgoing/${paperNo}`)

        if (!uploadResult) {
          return NextResponse.json(
            { error: "Failed to upload file to storage" },
            { status: 500 }
          )
        }

        pdfPath = uploadResult.path
        pdfFileName = uploadResult.fileName
      } catch (fileError: any) {
        console.error("File upload error:", fileError)
        return NextResponse.json(
          { error: `File upload failed: ${fileError.message}` },
          { status: 500 }
        )
      }
    }

    const correspondence = await prisma.outgoingCorrespondence.create({
      data: {
        paperNo: paperNo,
        to: to,
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

    return NextResponse.json(correspondence, { status: 201 })
  } catch (error: any) {
    console.error("Error creating outgoing correspondence:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    })

    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid creator ID" },
        { status: 400 }
      )
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Paper number already exists" },
        { status: 400 }
      )
    }

    const errorMessage = process.env.NODE_ENV === "development"
      ? error.message || "Could not create outgoing correspondence"
      : "Could not create outgoing correspondence"

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
