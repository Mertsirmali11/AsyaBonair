import type { PrismaClient } from "@prisma/client"

function sanitizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  return s.length > 0 ? s.slice(0, 12) : "TOPL"
}

export function yearFromPlannedDateUtc(d: Date): number {
  return d.getUTCFullYear()
}

/**
 * Next number for `{code}-{year}-{nnn}` per meeting type and calendar year.
 * Sequence starts at 001; scans DB for same prefix to avoid collisions.
 */
export async function allocateMeetingNo(
  prisma: PrismaClient,
  meetingTypeId: bigint,
  plannedDate: Date
): Promise<string> {
  const mt = await prisma.meetingType.findUnique({
    where: { id: meetingTypeId },
    select: { code: true },
  })
  if (!mt) {
    throw new Error("Meeting type not found")
  }
  const code = sanitizeCode(mt.code ?? "TOPL")
  const year = yearFromPlannedDateUtc(plannedDate)
  const prefix = `${code}-${year}-`

  const existing = await prisma.meeting.findMany({
    where: { meetingNo: { startsWith: prefix } },
    select: { meetingNo: true },
  })

  let max = 0
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`^${escaped}-${year}-(\\d+)$`)
  for (const row of existing) {
    const m = row.meetingNo?.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }

  const next = max + 1
  if (next > 999) {
    throw new Error("Meeting number limit (999) reached for this type and year")
  }
  return `${code}-${year}-${String(next).padStart(3, "0")}`
}
