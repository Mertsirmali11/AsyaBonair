import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { deletePdfFromStorage } from "@/lib/supabase-storage"
import { canAccessHazardReport } from "@/lib/hazard-access"

export async function DELETE(
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
    const reportId = parseInt(id)

    if (isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 })
    }

    const report = await prisma.hazardReport.findUnique({
      where: { id: reportId },
      include: { attachments: true },
    })

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

    for (const a of report.attachments) {
      await deletePdfFromStorage(a.storagePath)
    }

    await prisma.hazardReport.delete({
      where: { id: reportId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting hazard report:", error)

    return NextResponse.json(
      { error: "Could not delete hazard report" },
      { status: 500 }
    )
  }
}
