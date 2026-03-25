/**
 * App-wide "today" for dashboard filters. PG @db.Date values line up with UTC midnight
 * for the calendar day (same as new Date("yyyy-mm-dd")).
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Istanbul"

export function getCalendarYmdInTimeZone(
  timeZone: string,
  instant: Date = new Date()
): { year: number; month: number; day: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
  const [y, m, d] = s.split("-").map(Number)
  return { year: y, month: m, day: d }
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
