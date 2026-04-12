import { canAccessQualityOrAdminSettings, isAdminDepartment } from "@/lib/department-access"

/** Compliance Monitoring menüsü — Quality ve Admin (audit / uyumluluk). */
export function canViewComplianceMonitoringNav(
  departman: string | null | undefined
): boolean {
  return canAccessQualityOrAdminSettings(departman)
}

/** Safety Management — yalnızca Admin departmanı. */
export function canViewSafetyManagementNav(
  departman: string | null | undefined
): boolean {
  return isAdminDepartment(departman)
}

