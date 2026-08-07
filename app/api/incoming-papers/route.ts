import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  type IncomingStoredAttachment,
} from "@/lib/incoming-correspondence-attachments"
import { setIncomingPdfAttachmentsJsonb } from "@/lib/persist-correspondence-pdf-jsonb"
import { moveInStorage, deletePdfFromStorage } from "@/lib/supabase-storage"

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

    const body = (await request.json().catch(() => null)) as {
      from?: string
      subject?: string
      date?: string
      content?: string
      createdBy?: string
      attachments?: { path: string; fileName: string }[]
    } | null
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const from = String(body.from ?? "").trim()
    const subject = String(body.subject ?? "").trim()
    const dateStr = String(body.date ?? "").trim()
    const content = String(body.content ?? "")
    const createdBy = String(body.createdBy ?? "")
    // Bu ekler, tarayıcının /api/correspondence-uploads üzerinden doğrudan
    // Supabase'e önceden yüklediği "pending" dosyalara işaret eder — burada
    // sadece paperNo klasörüne TAŞINIR (veri transferi yok, hızlı).
    const pendingAttachments = Array.isArray(body.attachments)
      ? body.attachments.filter(
          (a): a is { path: string; fileName: string } =>
            !!a && typeof a.path === "string" && typeof a.fileName === "string"
        )
      : []

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

    if (pendingAttachments.length > 0) {
      const moved: IncomingStoredAttachment[] = []
      try {
        for (const att of pendingAttachments) {
          const target = `${paperNo}/${att.fileName}`
          const moveResult = await moveInStorage(att.path, target)
          if (!moveResult.ok) {
            for (const m of moved) {
              await deletePdfFromStorage(m.path)
            }
            return NextResponse.json(
              {
                error: `Dosya taşınamadı (${att.fileName}): ${moveResult.message}`,
              },
              { status: 500 }
            )
          }
          moved.push({ path: target, fileName: att.fileName })
        }
      } catch (fileError: unknown) {
        console.error("File move error:", fileError)
        const msg = fileError instanceof Error ? fileError.message : "Unknown error"
        return NextResponse.json(
          { error: `File move failed: ${msg}` },
          { status: 500 }
        )
      }

      pdfAttachments = moved
      pdfPath = moved[0]?.path ?? null
      pdfFileName = moved[0]?.fileName ?? null
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
