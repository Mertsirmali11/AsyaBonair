import { isAdminDepartment } from "@/lib/department-access"

/** Destek taleplerini yönetme (durum + admin aksiyonu) — yalnızca Admin departmanı. */
export function canManageSupportTicketsAsAdmin(
  departman: string | null | undefined
): boolean {
  return isAdminDepartment(departman)
}
