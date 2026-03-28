/**
 * Calendar date in Europe/Istanbul when the admin approves — used as `iseGirisTarihi` (@db.Date).
 */
export function hireDateFromApprovalTimestamp(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const d = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !d) {
    const u = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return u
  }
  return new Date(`${y}-${m}-${d}T12:00:00.000Z`)
}
