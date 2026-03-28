/** `dd.mm.yyyy` → `yyyy-mm-dd` for DB / Date parsing */
export function turkeyDateStringToIso(turkeyDate: string): string {
  if (!turkeyDate) return ""
  const parts = turkeyDate.split(".")
  if (parts.length !== 3) return turkeyDate
  const [day, month, year] = parts
  return `${year}-${month}-${day}`
}
