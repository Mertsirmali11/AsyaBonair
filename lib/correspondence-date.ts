/** Map Prisma/PG `@db.Date` (UTC midnight) to `dd.MM.yyyy` for DatePicker. */
export function dbDateToDdMmYyyy(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const year = String(d.getUTCFullYear())
  return `${day}.${month}.${year}`
}
