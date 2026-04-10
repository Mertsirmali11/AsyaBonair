import { Prisma } from "@prisma/client"

import type { PrismaClient } from "@prisma/client"
import { APP_TIMEZONE, getCalendarYmdInTimeZone } from "@/lib/day-range"
import {
  matchDepartmentKeyFromPaperNo,
  parseOutgoingNumberParts,
  type OutgoingDeptConfigLike,
} from "@/lib/outgoing-correspondence-departments"

type Tx = Prisma.TransactionClient

export type OutgoingDeptAllocConfig = {
  paperPrefix: string
  includeYearInPaperNo: boolean
}

export async function allocateOutgoingPaperNo(
  tx: Tx,
  departmentKey: string,
  dept: OutgoingDeptAllocConfig
): Promise<string> {
  const prefix = dept.paperPrefix.trim().toUpperCase()
  const { year: istanbulYear } = getCalendarYmdInTimeZone(APP_TIMEZONE)
  const slotYear = dept.includeYearInPaperNo ? istanbulYear : 0

  const released = await tx.outgoingCorrespondenceReleasedSlot.findFirst({
    where: { departmentKey, calendarYear: slotYear },
    orderBy: { sequence: "asc" },
  })
  let seq: number
  if (released) {
    await tx.outgoingCorrespondenceReleasedSlot.delete({
      where: { id: released.id },
    })
    seq = released.sequence
  } else {
    const rows = await tx.outgoingCorrespondence.findMany({
      where: { departmentKey },
      select: { paperNo: true },
    })
    let maxSeq = 0
    for (const r of rows) {
      if (!r.paperNo) continue
      const parts = parseOutgoingNumberParts(r.paperNo, prefix)
      if (parts.sequence == null) continue
      if (dept.includeYearInPaperNo) {
        if (parts.calendarYear !== istanbulYear) continue
      } else if (parts.calendarYear != null) {
        continue
      }
      if (parts.sequence > maxSeq) maxSeq = parts.sequence
    }
    seq = maxSeq + 1
  }

  if (dept.includeYearInPaperNo) {
    return `${prefix}-${istanbulYear}-${String(seq).padStart(3, "0")}`
  }
  return `${prefix}-${String(seq).padStart(3, "0")}`
}

export async function releaseOutgoingPaperSlot(
  db: PrismaClient | Tx,
  params: {
    departmentKey: string
    paperNo: string
    paperPrefix: string
  }
): Promise<void> {
  const parts = parseOutgoingNumberParts(params.paperNo, params.paperPrefix)
  if (parts.sequence == null) return
  const calendarYear = parts.calendarYear ?? 0
  try {
    await db.outgoingCorrespondenceReleasedSlot.create({
      data: {
        departmentKey: params.departmentKey,
        calendarYear,
        sequence: parts.sequence,
      },
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return
    }
    throw e
  }
}

export function resolveOutgoingDeptForRelease(
  row: { paperNo: string | null; departmentKey: string | null },
  configs: OutgoingDeptConfigLike[]
): { departmentKey: string; paperPrefix: string } | null {
  if (!row.paperNo) return null
  const key =
    row.departmentKey ?? matchDepartmentKeyFromPaperNo(row.paperNo, configs)
  if (!key) return null
  const prefix = configs.find((c) => c.key === key)?.paperPrefix
  if (!prefix) return null
  return { departmentKey: key, paperPrefix: prefix }
}
