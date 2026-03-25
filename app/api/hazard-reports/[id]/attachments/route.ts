import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import {
  canAccessHazardReport,
  canUploadHazardAttachments,
} from "@/lib/hazard-access"
import { persistHazardFilesFromUploads } from "@/lib/hazard-attachments-db"

async function getReportOr404(id: number) {
  return prisma.hazardReport.findUnique({
    where: { id },
    select: {
      id: true,
      reportedBy: true,
      isAnonymous: true,
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = parseInt(session.user?.id || "0")
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 })
    }

    const report = await getReportOr404(reportId)
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (
      !canAccessHazardReport(userId, session.user?.departman, {
        reportedBy: report.reportedBy,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const attachments = await prisma.hazardAttachment.findMany({
      where: { hazardReportId: reportId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        kind: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ reportId, attachments })
  } catch (e) {
    console.error("GET hazard attachments:", e)
    return NextResponse.json(
      { error: "Could not load attachments" },
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = parseInt(session.user?.id || "0")
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 })
    }

    const report = await prisma.hazardReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportedBy: true,
        isAnonymous: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (
      !canUploadHazardAttachments(userId, session.user?.departman, {
        reportedBy: report.reportedBy,
        isAnonymous: report.isAnonymous,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const rawFiles = formData.getAll("files")
    const files: File[] = []
    for (const f of rawFiles) {
      if (f instanceof File && f.size > 0) files.push(f)
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      )
    }

    const fileStats = await persistHazardFilesFromUploads(reportId, files)

    const count = await prisma.hazardAttachment.count({
      where: { hazardReportId: reportId },
    })

    return NextResponse.json({
      uploaded: fileStats.ok,
      failed: fileStats.failed,
      totalAttachments: count,
    })
  } catch (e) {
    console.error("POST hazard attachments:", e)
    return NextResponse.json(
      { error: "Could not upload attachments" },
      { status: 500 }
    )
  }
}
