/**
 * Kurum departmanları — `components/user-management` ile aynı sabit liste
 * (manuel sahibi departmanı ve çalışan formu tek kaynak).
 */
export const ORGANIZATION_DEPARTMENTS = [
  "Maintenance",
  "Human Resources",
  "Handling",
  "Camo",
  "Engineering",
  "Kitchen & Cleaning Staff",
  "Supply",
  "Accounting",
  "Compliance",
  "Quality",
  "Admin",
  "Administrative Affairs",
  "IT",
  "Planning",
  "Pilot",
] as const

export type OrganizationDepartment = (typeof ORGANIZATION_DEPARTMENTS)[number]

export function getOrganizationDepartmentOptions(): string[] {
  return [...ORGANIZATION_DEPARTMENTS]
}

/** Varsayılan sıra korunur; ek isimler alfabetik sonda, tekrarsız (büyük/küçük harf). */
export function mergeDepartmentLists(
  base: readonly string[],
  extra: string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const tryPush = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }
  for (const b of base) tryPush(b)
  const extras: string[] = []
  for (const e of extra) {
    const t = e.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    extras.push(t)
  }
  extras.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
  return [...out, ...extras]
}

export function isOrganizationDepartment(
  value: string | null | undefined
): value is OrganizationDepartment {
  return (
    !!value &&
    (ORGANIZATION_DEPARTMENTS as readonly string[]).includes(value.trim())
  )
}

const MAX_CUSTOM_MANUAL_DEPARTMENT_LEN = 100

/** Listede olmayan manuel sahibi departmanı (serbest metin, kontrollü uzunluk). */
export function isValidCustomManualDepartment(value: string | null | undefined): boolean {
  const t = (value ?? "").trim()
  if (t.length < 1 || t.length > MAX_CUSTOM_MANUAL_DEPARTMENT_LEN) return false
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t)
}
