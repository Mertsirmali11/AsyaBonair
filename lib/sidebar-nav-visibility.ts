import {
  canAccessConfigurationsArea,
  canAccessQualityOrAdminSettings,
  canApproveWorkerRegistrations,
} from "@/lib/department-access"
import {
  DEPARTMENT_PERMISSION_KEYS,
  type DepartmentPermissionKey,
} from "@/lib/department-permission-keys"
import { legacyDepartmentPermission } from "@/lib/department-permissions-legacy"
import type { ResolvedDepartmentPermissions } from "@/lib/department-permissions-resolve"

export type SidebarNavVisibilityInput = {
  departman: string | null | undefined
  permissions: ResolvedDepartmentPermissions | null
  showAuditPlanNav: boolean
}

function resolvePermission(
  input: SidebarNavVisibilityInput,
  key: DepartmentPermissionKey,
  legacyWhenMissing: boolean
): boolean {
  const { permissions, departman } = input
  if (permissions && typeof permissions[key] === "boolean") {
    return permissions[key]
  }
  if (permissions) {
    return legacyDepartmentPermission(key, departman)
  }
  return legacyWhenMissing
}

/** Sidebar ve sayfa yönlendirmeleri için ortak menü görünürlüğü. */
export function getSidebarNavVisibility(input: SidebarNavVisibilityInput) {
  const compliance = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING,
    canAccessQualityOrAdminSettings(input.departman)
  )
  const configurations = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA,
    canAccessConfigurationsArea(input.departman)
  )
  const workerApproval = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL,
    canApproveWorkerRegistrations(input.departman)
  )
  const meetings = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.MEETINGS,
    canAccessQualityOrAdminSettings(input.departman)
  )
  const tasks = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.TASKS_ACTIONS,
    canAccessQualityOrAdminSettings(input.departman)
  )
  const controlledDocuments = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS,
    true
  )
  const leaveRequests = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.LEAVE_REQUESTS,
    true
  )
  const companyStatus = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.COMPANY_STATUS,
    true
  )
  const aiReports = resolvePermission(
    input,
    DEPARTMENT_PERMISSION_KEYS.AI_REPORTS,
    true
  )

  const showComplianceNav = compliance || input.showAuditPlanNav

  return {
    compliance,
    configurations,
    workerApproval,
    meetings,
    tasks,
    controlledDocuments,
    leaveRequests,
    companyStatus,
    aiReports,
    showComplianceNav,
    /** Yalnızca Configurations alanı yetkisi — Compliance ayrı menüde. */
    showConfigurationsNav: configurations,
    showCorrespondencesNav: configurations,
    showControlledDocumentsNav: controlledDocuments,
    showAircraftSettingsNav: configurations,
    showPerformanceReportsNav: compliance,
    showAnnouncementManageNav: configurations,
  }
}
