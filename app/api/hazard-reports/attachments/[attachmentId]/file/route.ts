import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessHazardReport } from "@/lib/hazard-access"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = parseInt(session.user?.id || "0")
    const { attachmentId } = await params
    const id = parseInt(attachmentId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 })
    }

    const attachment = await prisma.hazardAttachment.findUnique({
      where: { id },
      include: {
        hazardReport: {
          select: { reportedBy: true },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (
      !canAccessHazardReport(userId, session.user?.departman, {
        reportedBy: attachment.hazardReport.reportedBy,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buffer = await downloadPdfFromStorage(attachment.storagePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      )
    }

    const contentType = attachment.mimeType || "application/octet-stream"
    const safeName = attachment.fileName.replace(/[\r\n"]/g, "_")

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e) {
    console.error("GET hazard attachment file:", e)
    return NextResponse.json(
      { error: "Could not serve file" },
      { status: 500 }
    )
  }
}
