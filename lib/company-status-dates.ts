const MAX_RANGE_DAYS = 90

export function parseIsoDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Inclusive UTC calendar days from start through end. */
export function eachDayInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(start)
  while (cur.getTime() <= end.getTime()) {
    days.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export function resolveStatusDateRange(
  startRaw: unknown,
  endRaw: unknown
):
  | { ok: true; days: Date[]; start: Date | null; end: Date | null }
  | { ok: false; error: string } {
  const start = parseIsoDate(startRaw)
  const end = parseIsoDate(endRaw)

  if (!start && end) {
    return { ok: false, error: "RANGE_END_WITHOUT_START" }
  }

  if (!start) {
    const today = new Date()
    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    )
    return { ok: true, days: [todayUTC], start: null, end: null }
  }

  const rangeEnd = end ?? start
  if (rangeEnd.getTime() < start.getTime()) {
    return { ok: false, error: "RANGE_END_BEFORE_START" }
  }

  const days = eachDayInRange(start, rangeEnd)
  if (days.length > MAX_RANGE_DAYS) {
    return { ok: false, error: "RANGE_TOO_LONG" }
  }

  return {
    ok: true,
    days,
    start,
    end: end && end.getTime() !== start.getTime() ? rangeEnd : null,
  }
}

export function formatWorkLocationDateLabel(
  start: string | null,
  end: string | null
): string | null {
  if (!start) return null
  if (end && end !== start) return `${start} – ${end}`
  return start
}
