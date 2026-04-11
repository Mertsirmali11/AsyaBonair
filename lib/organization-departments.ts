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
