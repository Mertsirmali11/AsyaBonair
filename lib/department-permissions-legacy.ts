import {
  canAccessConfigurationsArea,
  canAccessQualityOrAdminSettings,
  canApproveWorkerRegistrations,
  isAdminDepartment,
} from "@/lib/department-access"
import {
  DEPARTMENT_PERMISSION_KEYS,
  isKnownDepartmentPermissionKey,
} from "@/lib/department-permission-keys"

/**
 * Veritabanında satır yokken kullanılan sabit kurallar (`department-access.ts`).
 * `departman` mümkünse çalışanın gerçek `departman` metni olmalı (özellikle worker onayı env listesi için).
 */
export function legacyDepartmentPermission(
  permissionKey: string,
  departman: string | null | undefined
): boolean {
  if (!isKnownDepartmentPermissionKey(permissionKey)) return false
  switch (permissionKey) {
    case DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING:
      return canAccessQualityOrAdminSettings(departman)
    case DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT:
      return isAdminDepartment(departman)
    case DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA:
      return canAccessConfigurationsArea(departman)
    case DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL:
      return canApproveWorkerRegistrations(departman)
    default:
      return false
  }
}
