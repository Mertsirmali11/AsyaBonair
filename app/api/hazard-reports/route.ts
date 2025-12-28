import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"

// GET - Get all hazard reports
export async function GET() {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const reports = await prisma.hazardReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
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

    return NextResponse.json(reports)
  } catch (error) {
    console.error("Error fetching hazard reports:", error)
    return NextResponse.json(
      { error: "Could not fetch hazard reports" },
      { status: 500 }
    )
  }
}

// POST - Create new hazard report
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate event date
    if (!body.eventDate) {
      return NextResponse.json(
        { error: "Event date is required" },
        { status: 400 }
      )
    }

    // Validate that date is not in the future
    const eventDate = new Date(body.eventDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    if (eventDate > today) {
      return NextResponse.json(
        { error: "Event date cannot be in the future" },
        { status: 400 }
      )
    }

    // Validate that if not anonymous, reportedBy must be provided
    if (!body.isAnonymous && !body.reportedBy) {
      return NextResponse.json(
        { error: "Reporter ID is required when not anonymous" },
        { status: 400 }
      )
    }

    const report = await prisma.hazardReport.create({
      data: {
        eventDate: eventDate,
        sourceType: body.sourceType || null,
        isAnonymous: body.isAnonymous || false,
        title: body.title || null,
        details: body.details || null,
        reportedBy: body.isAnonymous ? null : parseInt(body.reportedBy),
      },
      include: {
        reporter: {
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

    return NextResponse.json(report, { status: 201 })
  } catch (error: any) {
    console.error("Error creating hazard report:", error)
    
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid reporter ID" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Could not create hazard report" },
      { status: 500 }
    )
  }
}

