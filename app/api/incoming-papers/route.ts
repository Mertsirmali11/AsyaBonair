import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// GET - Get all incoming papers
export async function GET() {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const papers = await prisma.incomingPaper.findMany({
      orderBy: { createdAt: "desc" },
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
    console.error("Error fetching incoming papers:", error)
    return NextResponse.json(
      { error: "Could not fetch incoming papers" },
      { status: 500 }
    )
  }
}

// POST - Create new incoming paper
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    
    const from = formData.get("from") as string
    const subject = formData.get("subject") as string
    const dateStr = formData.get("date") as string
    const content = formData.get("content") as string
    const createdBy = formData.get("createdBy") as string
    const pdfFile = formData.get("pdf") as File | null

    // Validate required fields
    if (!from || !subject || !dateStr) {
      return NextResponse.json(
        { error: "From, Subject, and Date are required" },
        { status: 400 }
      )
    }

    // Validate date
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    // Generate paper number (BON-IP-001, BON-IP-002, etc.)
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

    // Handle PDF file upload
    let pdfPath: string | null = null
    let pdfFileName: string | null = null

    if (pdfFile && pdfFile.size > 0) {
      // Validate file size (50MB)
      const maxSize = 50 * 1024 * 1024
      if (pdfFile.size > maxSize) {
        return NextResponse.json(
          { error: "File size exceeds 50MB limit" },
          { status: 400 }
        )
      }

      // Validate file type
      if (pdfFile.type !== "application/pdf") {
        return NextResponse.json(
          { error: "Only PDF files are allowed" },
          { status: 400 }
        )
      }

      // Create directory for this paper: public/uploads/incoming-papers/BON-IP-001/
      const uploadsDir = join(process.cwd(), "public", "uploads", "incoming-papers", paperNo)
      
      // Create directory if it doesn't exist
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Save file with original name
      pdfFileName = pdfFile.name
      const filePath = join(uploadsDir, pdfFileName)
      const bytes = await pdfFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Store relative path for database
      pdfPath = `/uploads/incoming-papers/${paperNo}/${pdfFileName}`
    }

    // Create paper in database
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

    return NextResponse.json(paper, { status: 201 })
  } catch (error: any) {
    console.error("Error creating incoming paper:", error)
    
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid creator ID" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Could not create incoming paper" },
      { status: 500 }
    )
  }
}

