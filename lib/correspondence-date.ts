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
