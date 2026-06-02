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
    case DEPARTMENT_PERMISSION_KEYS.MEETINGS:
    case DEPARTMENT_PERMISSION_KEYS.TASKS_ACTIONS:
      return canAccessQualityOrAdminSettings(departman)
    case DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS:
    case DEPARTMENT_PERMISSION_KEYS.LEAVE_REQUESTS:
    case DEPARTMENT_PERMISSION_KEYS.COMPANY_STATUS:
    case DEPARTMENT_PERMISSION_KEYS.AI_REPORTS:
      return true
    default:
      return false
  }
}
