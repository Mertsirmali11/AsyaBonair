import { prisma } from "@/lib/prisma-server"

export type CreateHazardReportInput = {
  eventDate: Date
  sourceType: string | null
  isAnonymous: boolean
  title: string | null
  details: string | null
  reportedBy: number | null
}

export async function generateNextHazardReportNo(): Promise<string> {
  const rows = await prisma.hazardReport.findMany({
    where: { reportNo: { not: null } },
    select: { reportNo: true },
  })
  let max = 0
  for (const r of rows) {
    if (!r.reportNo) continue
    const m = r.reportNo.match(/^BON-HR-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `BON-HR-${String(max + 1).padStart(3, "0")}`
}

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2002"
  )
}

export async function createHazardReportRecord(input: CreateHazardReportInput) {
  const maxAttempts = 10
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reportNo = await generateNextHazardReportNo()
    try {
      return await prisma.hazardReport.create({
        data: {
          reportNo,
          eventDate: input.eventDate,
          sourceType: input.sourceType,
          isAnonymous: input.isAnonymous,
          title: input.title,
          details: input.details,
          reportedBy: input.reportedBy,
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
    } catch (e) {
      if (isUniqueConstraintError(e) && attempt < maxAttempts - 1) {
        continue
      }
      throw e
    }
  }
  throw new Error("Could not allocate a unique report number")
}
