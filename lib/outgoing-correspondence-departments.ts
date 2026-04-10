/**
 * Giden yazışma: yazı no ayrıştırma ve departman eşlemesi.
 * Departman listesi veritabanında (OutgoingCorrespondenceDeptConfig); burada saf yardımcılar.
 */

export type OutgoingDeptConfigLike = {
  key: string
  label: string
  paperPrefix: string
  includeYearInPaperNo?: boolean
}

/** UI: örn. BON-CMM-NNN veya BON-CMM-YYYY-NNN (yıl İstanbul takvimi) */
export function outgoingPaperNoPatternLabel(dept: OutgoingDeptConfigLike): string {
  const p = dept.paperPrefix
  return dept.includeYearInPaperNo ? `${p}-YYYY-NNN` : `${p}-NNN`
}

/** Uzun önek önce (BON-CMM, BON-C gibi çakışmaları önlemek için) */
export function matchDepartmentKeyFromPaperNo(
  paperNo: string | null | undefined,
  configs: OutgoingDeptConfigLike[]
): string | null {
  if (!paperNo || !configs.length) return null
  const u = paperNo.toUpperCase()
  const sorted = [...configs].sort(
    (a, b) => b.paperPrefix.length - a.paperPrefix.length
  )
  for (const c of sorted) {
    if (u.startsWith(`${c.paperPrefix.toUpperCase()}-`)) return c.key
  }
  return null
}

/** @deprecated Kullanım: matchDepartmentKeyFromPaperNo(paperNo, configs) */
export function inferOutgoingDepartmentKeyFromPaperNo(
  paperNo: string | null | undefined,
  configs: OutgoingDeptConfigLike[]
): string | null {
  return matchDepartmentKeyFromPaperNo(paperNo, configs)
}

export function getOutgoingDepartmentLabel(
  key: string | null | undefined,
  configs?: OutgoingDeptConfigLike[]
): string {
  if (!key) return "—"
  const c = configs?.find((x) => x.key === key)
  return c?.label ?? key
}

const YEAR_TOKEN_RE = /^\d{4}$/

function isPlausibleCalendarYearToken(s: string): boolean {
  if (!YEAR_TOKEN_RE.test(s)) return false
  const y = Number.parseInt(s, 10)
  return y >= 1900 && y <= 2100
}

/**
 * BON-CMM-001 → { calendarYear: null, sequence: 1 }
 * BON-CMM-2026-003 → { calendarYear: 2026, sequence: 3 }
 */
export function parseOutgoingNumberParts(
  paperNo: string,
  prefix: string
): { calendarYear: number | null; sequence: number | null } {
  const marker = `${prefix.toUpperCase()}-`
  const u = paperNo.toUpperCase()
  if (!u.startsWith(marker)) return { calendarYear: null, sequence: null }
  const after = paperNo.slice(marker.length)
  const segments = after.split("-").filter(Boolean)
  if (segments.length === 0) return { calendarYear: null, sequence: null }

  if (segments.length >= 2 && isPlausibleCalendarYearToken(segments[0])) {
    const y = Number.parseInt(segments[0], 10)
    const last = segments[segments.length - 1]
    const seq = Number.parseInt(last, 10)
    return Number.isFinite(seq)
      ? { calendarYear: y, sequence: seq }
      : { calendarYear: y, sequence: null }
  }

  const last = segments[segments.length - 1]
  const seq = Number.parseInt(last, 10)
  return Number.isFinite(seq)
    ? { calendarYear: null, sequence: seq }
    : { calendarYear: null, sequence: null }
}

/** Son sıra numarası (yıl segmentinden bağımsız). */
export function parseOutgoingSequenceFromPaperNo(
  paperNo: string,
  prefix: string
): number | null {
  return parseOutgoingNumberParts(paperNo, prefix).sequence
}

export function computeNextOutgoingPaperNo(
  prefix: string,
  existingPaperNos: (string | null)[]
): string {
  const pref = prefix.toUpperCase()
  let maxSeq = 0
  for (const raw of existingPaperNos) {
    if (!raw) continue
    const n = parseOutgoingSequenceFromPaperNo(raw, pref)
    if (n != null && n > maxSeq) maxSeq = n
  }
  const next = maxSeq + 1
  return `${pref}-${String(next).padStart(3, "0")}`
}
