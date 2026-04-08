/** Varsayılan checklist numarası (örn. BON-CMM-CL-010) */
export function defaultChecklistNumber(id: number): string {
  return `BON-CMM-CL-${String(id).padStart(3, "0")}`
}

export function parseOptionalDateYmd(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null
  const d = new Date(`${s.trim()}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatYmdUtc(d: Date | null | undefined): string {
  if (!d) return "—"
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function serializeAuditChecklistItemRow(it: {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
  reference: string | null
  section: string | null
}) {
  return {
    id: it.id,
    label: it.label,
    sortOrder: it.sortOrder,
    isRequired: it.isRequired,
    reference: it.reference ?? "",
    section: it.section ?? "",
  }
}

export function revisionCell(
  rev: number,
  d: Date | string | null | undefined
): string {
  if (d == null || d === "") return `${rev} (—)`
  if (typeof d === "string") return `${rev} (${d.slice(0, 10)})`
  return `${rev} (${formatYmdUtc(d)})`
}
