import { Prisma } from "@prisma/client"

import type { PrismaClient } from "@prisma/client"
import { APP_TIMEZONE, getCalendarYmdInTimeZone } from "@/lib/day-range"
import {
  matchDepartmentKeyFromPaperNo,
  parseOutgoingNumberParts,
  type OutgoingDeptConfigLike,
} from "@/lib/outgoing-correspondence-departments"

type Tx = Prisma.TransactionClient

/** Preferred config key for the single BON-YYYY-XXX stream (created only if prefix is free). */
export const OUTGOING_SINGLE_STREAM_PREFERRED_KEY = "bon"
export const OUTGOING_SINGLE_STREAM_PREFIX = "BON"

export type OutgoingDeptAllocConfig = {
  paperPrefix: string
  includeYearInPaperNo: boolean
}

function formatOutgoingPaperNo(
  prefix: string,
  calendarYear: number | null,
  seq: number,
  includeYearInPaperNo: boolean
): string {
  if (includeYearInPaperNo && calendarYear != null) {
    return `${prefix}-${calendarYear}-${String(seq).padStart(3, "0")}`
  }
  return `${prefix}-${String(seq).padStart(3, "0")}`
}

async function isOutgoingPaperNoTaken(tx: Tx, paperNo: string): Promise<boolean> {
  const row = await tx.outgoingCorrespondence.findFirst({
    where: { paperNo: { equals: paperNo, mode: "insensitive" } },
    select: { id: true },
  })
  return row != null
}

async function maxSequenceForOutgoingYear(
  tx: Tx,
  prefix: string,
  istanbulYear: number
): Promise<number> {
  const yearHead = `${prefix}-${istanbulYear}-`
  const rows = await tx.outgoingCorrespondence.findMany({
    where: { paperNo: { startsWith: yearHead, mode: "insensitive" } },
    select: { paperNo: true },
  })
  const re = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}-${istanbulYear}-(\\d+)$`,
    "i"
  )
  let maxSeq = 0
  for (const r of rows) {
    if (!r.paperNo) continue
    const m = re.exec(r.paperNo.trim())
    if (!m) continue
    const n = Number.parseInt(m[1]!, 10)
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n
  }
  return maxSeq
}

async function maxSequenceWithoutYear(
  tx: Tx,
  departmentKey: string,
  prefix: string
): Promise<number> {
  const rows = await tx.outgoingCorrespondence.findMany({
    where: { departmentKey },
    select: { paperNo: true },
  })
  let maxSeq = 0
  for (const r of rows) {
    if (!r.paperNo) continue
    const parts = parseOutgoingNumberParts(r.paperNo, prefix)
    if (parts.sequence == null) continue
    if (parts.calendarYear != null) continue
    if (parts.sequence > maxSeq) maxSeq = parts.sequence
  }
  return maxSeq
}

export async function allocateOutgoingPaperNo(
  tx: Tx,
  departmentKey: string,
  dept: OutgoingDeptAllocConfig
): Promise<string> {
  const prefix = dept.paperPrefix.trim().toUpperCase()
  const { year: istanbulYear } = getCalendarYmdInTimeZone(APP_TIMEZONE)
  const slotYear = dept.includeYearInPaperNo ? istanbulYear : 0

  const releasedList = await tx.outgoingCorrespondenceReleasedSlot.findMany({
    where: { departmentKey, calendarYear: slotYear },
    orderBy: { sequence: "asc" },
  })

  for (const released of releasedList) {
    await tx.outgoingCorrespondenceReleasedSlot.delete({
      where: { id: released.id },
    })
    const candidate = formatOutgoingPaperNo(
      prefix,
      dept.includeYearInPaperNo ? istanbulYear : null,
      released.sequence,
      dept.includeYearInPaperNo
    )
    if (!(await isOutgoingPaperNoTaken(tx, candidate))) {
      return candidate
    }
    // Stale released slot (number still in use) — skip and try next / max+1.
  }

  let seq =
    (dept.includeYearInPaperNo
      ? await maxSequenceForOutgoingYear(tx, prefix, istanbulYear)
      : await maxSequenceWithoutYear(tx, departmentKey, prefix)) + 1

  for (;;) {
    const candidate = formatOutgoingPaperNo(
      prefix,
      dept.includeYearInPaperNo ? istanbulYear : null,
      seq,
      dept.includeYearInPaperNo
    )
    if (!(await isOutgoingPaperNoTaken(tx, candidate))) {
      return candidate
    }
    seq++
  }
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

/** Resolves dept config for BON-YYYY-XXX without violating unique `paper_prefix`. */
export async function ensureOutgoingSingleStreamDept(
  db: PrismaClient
): Promise<{
  departmentKey: string
  paperPrefix: string
  includeYearInPaperNo: boolean
}> {
  const preferred = await db.outgoingCorrespondenceDeptConfig.findUnique({
    where: { key: OUTGOING_SINGLE_STREAM_PREFERRED_KEY },
  })
  if (preferred) {
    await db.outgoingCorrespondenceDeptConfig.update({
      where: { key: preferred.key },
      data: {
        label: "Outgoing",
        includeYearInPaperNo: true,
        isActive: true,
        sortOrder: 0,
      },
    })
    return {
      departmentKey: preferred.key,
      paperPrefix: preferred.paperPrefix,
      includeYearInPaperNo: preferred.includeYearInPaperNo,
    }
  }

  const byPrefix = await db.outgoingCorrespondenceDeptConfig.findFirst({
    where: {
      paperPrefix: {
        equals: OUTGOING_SINGLE_STREAM_PREFIX,
        mode: "insensitive",
      },
    },
    orderBy: { id: "asc" },
  })
  if (byPrefix) {
    await db.outgoingCorrespondenceDeptConfig.update({
      where: { key: byPrefix.key },
      data: {
        label: "Outgoing",
        includeYearInPaperNo: true,
        isActive: true,
      },
    })
    return {
      departmentKey: byPrefix.key,
      paperPrefix: byPrefix.paperPrefix,
      includeYearInPaperNo: byPrefix.includeYearInPaperNo,
    }
  }

  const created = await db.outgoingCorrespondenceDeptConfig.create({
    data: {
      key: OUTGOING_SINGLE_STREAM_PREFERRED_KEY,
      label: "Outgoing",
      paperPrefix: OUTGOING_SINGLE_STREAM_PREFIX,
      includeYearInPaperNo: true,
      sortOrder: 0,
      isActive: true,
    },
  })
  return {
    departmentKey: created.key,
    paperPrefix: created.paperPrefix,
    includeYearInPaperNo: created.includeYearInPaperNo,
  }
}

export function prismaUniqueConstraintFields(error: unknown): string[] {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return []
  }
  const target = error.meta?.target
  if (Array.isArray(target)) {
    return target.map((t) => String(t).toLowerCase())
  }
  if (typeof target === "string") {
    return [target.toLowerCase()]
  }
  const msg = error.message.toLowerCase()
  const fields: string[] = []
  if (msg.includes("paper_prefix") || msg.includes("(`paper_prefix`)")) {
    fields.push("paper_prefix")
  }
  if (msg.includes("paper_no") || msg.includes("(`paper_no`)")) {
    fields.push("paper_no")
  }
  return fields
}

export function outgoingCorrespondenceCreateErrorMessage(
  error: unknown
): string | null {
  const fields = prismaUniqueConstraintFields(error)
  if (fields.length === 0) return null
  if (fields.some((f) => f.includes("paper_prefix"))) {
    return (
      "Numbering setup conflict: prefix BON is already registered under another " +
      "department in Configurations → Correspondences. Edit or remove the duplicate entry."
    )
  }
  if (fields.some((f) => f.includes("paper_no"))) {
    return "Paper number already exists"
  }
  return null
}

export function isOutgoingNumberAllocationRetryable(
  error: unknown
): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const fields = prismaUniqueConstraintFields(error)
    if (fields.length === 0) return true
    return fields.some((f) => f.includes("paper_no"))
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034"
  }
  const msg =
    error instanceof Error ? error.message : String(error ?? "")
  return (
    msg.includes("could not serialize") ||
    msg.includes("serialization failure") ||
    msg.includes("40001")
  )
}
