import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"

// DELETE - Delete a hazard report
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const reportId = parseInt(params.id)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400 }
      )
    }

    // Check if report exists
    const report = await prisma.hazardReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    // Delete the report
    await prisma.hazardReport.delete({
      where: { id: reportId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting hazard report:", error)
    
    return NextResponse.json(
      { error: "Could not delete hazard report" },
      { status: 500 }
    )
  }
}

