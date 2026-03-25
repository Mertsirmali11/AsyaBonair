/** Display dates/times in Turkey (Istanbul), 24-hour clock. */
export const APP_TIMEZONE = "Europe/Istanbul"
export const APP_LOCALE = "tr-TR"

export function formatDateTimeIstanbul(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

export function formatDateOnlyIstanbul(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

export function formatTimeOnlyIstanbul(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d)
}
