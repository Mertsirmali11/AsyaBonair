import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { createHazardReportRecord } from "@/lib/hazard-report-create"
import { persistHazardFilesFromUploads } from "@/lib/hazard-attachments-db"

async function resolveReporterCalisanId(session: {
  user?: { id?: string | null; email?: string | null }
}): Promise<number | null> {
  const email = session.user?.email?.trim()
  if (email) {
    const row = await prisma.calisan.findUnique({
      where: { email },
      select: { id: true },
    })
    if (row) return row.id
  }
  const fromToken = parseInt(String(session.user?.id ?? ""), 10)
  if (!Number.isNaN(fromToken) && fromToken > 0) return fromToken
  return null
}

function validateEventDate(eventDateStr: string | null | undefined):
  | { ok: true; date: Date }
  | { ok: false; error: string } {
  if (!eventDateStr) {
    return { ok: false, error: "Event date is required" }
  }
  const eventDate = new Date(eventDateStr)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (eventDate > today) {
    return { ok: false, error: "Event date cannot be in the future" }
  }
  return { ok: true, date: eventDate }
}

export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userDepartman = session.user?.departman
    const userId = await resolveReporterCalisanId(session)

    if (
      userDepartman !== "Quality" &&
      userDepartman !== "Human Resources" &&
      userId == null
    ) {
      return NextResponse.json([])
    }

    const whereClause =
      userDepartman === "Quality" || userDepartman === "Human Resources"
        ? {}
        : { reportedBy: userId! }

    const reports = await prisma.hazardReport.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 300,
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

    const ids = reports.map((r) => r.id)
    const attachmentGroups =
      ids.length === 0
        ? []
        : await prisma.hazardAttachment.groupBy({
            by: ["hazardReportId"],
            where: { hazardReportId: { in: ids } },
            _count: { _all: true },
          })
    const attachmentCountByReportId = new Map(
      attachmentGroups.map((g) => [g.hazardReportId, g._count._all])
    )

    const reportsWithCount = reports.map((r) => ({
      ...r,
      _count: { attachments: attachmentCountByReportId.get(r.id) ?? 0 },
    }))

    return NextResponse.json(reportsWithCount)
  } catch (error) {
    console.error("Error fetching hazard reports:", error)
    return NextResponse.json(
      { error: "Could not fetch hazard reports" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reporterCalisanId = await resolveReporterCalisanId(session)
    if (reporterCalisanId == null) {
      return NextResponse.json(
        { error: "Could not resolve your employee record. Please sign out and sign in again." },
        { status: 401 }
      )
    }

    const contentType = request.headers.get("content-type") || ""

    let eventDateStr: string | undefined
    let sourceType: string | null = null
    let isAnonymous = false
    let title: string | null = null
    let details: string | null = null
    let reportedBy: number | null = null
    const files: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      eventDateStr = (formData.get("eventDate") as string) || undefined
      const st = formData.get("sourceType")
      sourceType =
        st != null && String(st).trim() !== "" ? String(st) : null
      isAnonymous = formData.get("isAnonymous") === "true"
      const t = formData.get("title")
      title = t != null && String(t).trim() !== "" ? String(t) : null
      const d = formData.get("details")
      details = d != null && String(d).trim() !== "" ? String(d) : null
      if (!isAnonymous) {
        reportedBy = reporterCalisanId
      } else {
        reportedBy = null
      }
      const rawFiles = formData.getAll("files")
      for (const f of rawFiles) {
        if (f instanceof File && f.size > 0) files.push(f)
      }
    } else {
      const body = await request.json()
      eventDateStr = body.eventDate
      sourceType = body.sourceType ?? null
      isAnonymous = Boolean(body.isAnonymous)
      title = body.title ?? null
      details = body.details ?? null
      if (body.isAnonymous) {
        reportedBy = null
      } else {
        reportedBy = reporterCalisanId
      }
    }

    const validated = validateEventDate(eventDateStr)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    if (!isAnonymous && reportedBy == null) {
      return NextResponse.json(
        { error: "Reporter ID is required when not anonymous" },
        { status: 400 }
      )
    }

    const report = await createHazardReportRecord({
      eventDate: validated.date,
      sourceType,
      isAnonymous,
      title,
      details,
      reportedBy,
    })

    let fileStats = { ok: 0, failed: 0 }
    if (files.length > 0) {
      fileStats = await persistHazardFilesFromUploads(report.id, files)
    }

    const full = await prisma.hazardReport.findUnique({
      where: { id: report.id },
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

    const attachmentCount = await prisma.hazardAttachment.count({
      where: { hazardReportId: report.id },
    })

    const res = NextResponse.json(
      {
        ...full,
        _count: { attachments: attachmentCount },
        _uploadStats:
          files.length > 0
            ? { uploaded: fileStats.ok, failed: fileStats.failed }
            : undefined,
      },
      { status: 201 }
    )
    return res
  } catch (error: unknown) {
    console.error("Error creating hazard report:", error)
    const code = (error as { code?: string })?.code
    if (code === "P2003") {
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
