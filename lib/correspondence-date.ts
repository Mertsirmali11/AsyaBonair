/** Today in the user's local calendar as `dd.MM.yyyy` (for new correspondence rows). */
export function todayLocalDdMmYyyy(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = String(d.getFullYear())
  return `${day}.${month}.${year}`
}

/** Map Prisma/PG `@db.Date` (UTC midnight) to `dd.MM.yyyy` for DatePicker. */
export function dbDateToDdMmYyyy(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const year = String(d.getUTCFullYear())
  return `${day}.${month}.${year}`
}

/**
 * Reusable input mask for every manual `dd.MM.yyyy` date field in the app (Audit Plan,
 * Correspondence, Planner, User Management, …) — the single shared `DatePicker` component
 * (components/ui/date-picker.tsx) calls this on every keystroke/paste so the user only ever
 * types digits; dots are inserted automatically at the right positions. Strips everything
 * that isn't a digit, caps at 8 digits (ddMMyyyy), then re-groups progressively:
 * "2" -> "27" -> "27.0" -> "27.08" -> "27.08.2" -> "27.08.2026". Works identically whether
 * the digits came from typing or from a paste of either "27082026" or "27.08.2026".
 */
export function formatDateInputMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

/** True once the user has typed all 8 digits of a `dd.MM.yyyy` value (mask-complete, not necessarily a valid calendar date). */
export function isDateInputComplete(masked: string): boolean {
  return masked.replace(/\D/g, "").length === 8
}

/** Parse `dd.MM.yyyy` to UTC midnight `Date` for `@db.Date` fields. */
export function parseDdMmYyyyToUtcDate(s: string): Date | null {
  const parts = s.trim().split(".")
  if (parts.length !== 3) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  const year = Number(parts[2])
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }
  return d
}
