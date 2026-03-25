/**
 * App-wide "today" for dashboard filters. PG @db.Date values line up with UTC midnight
 * for the calendar day (same as new Date("yyyy-mm-dd")).
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Istanbul"

export function getCalendarYmdInTimeZone(
  timeZone: string,
  instant: Date = new Date()
): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = dtf.formatToParts(instant)
  const y = Number(parts.find((p) => p.type === "year")?.value)
  const m = Number(parts.find((p) => p.type === "month")?.value)
  const d = Number(parts.find((p) => p.type === "day")?.value)
  return { year: y, month: m, day: d }
}

/** `YYYY-MM-DD` for SQL `::date` filters (matches PG DATE, no TZ drift). */
export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** [start, end) UTC instants for that civil date (matches Prisma/PG DATE at 00:00Z). */
export function getUtcRangeForCalendarDate(
  year: number,
  month: number,
  day: number
): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0)),
  }
}

export function getTodayUtcRange(
  timeZone: string = APP_TIMEZONE
): { start: Date; end: Date } {
  const { year, month, day } = getCalendarYmdInTimeZone(timeZone)
  return getUtcRangeForCalendarDate(year, month, day)
}

/**
 * İstanbul takvim günü için [start, end) UTC aralığı (rapor `created_at` filtreleri).
 * TRT sürekli UTC+3; `Europe/Istanbul` ile uyumlu modern tarihler için yeterlidir.
 */
export function getIstanbulLocalDayUtcRange(
  year: number,
  month: number,
  day: number
): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, "0")
  const start = new Date(
    `${year}-${pad(month)}-${pad(day)}T00:00:00+03:00`
  )
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}
