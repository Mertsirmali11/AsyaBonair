import { isAdminDepartment } from "@/lib/department-access"

/** Hazard Inbox / tüm raporlar: yalnızca Admin ve Quality. */
export function canViewAllHazardReports(
  departman: string | null | undefined
): boolean {
  return departman === "Quality" || isAdminDepartment(departman)
}

export function canAccessHazardReport(
  userId: number,
  userDepartman: string | null | undefined,
  report: { reportedBy: number | null }
): boolean {
  if (canViewAllHazardReports(userDepartman)) {
    return true
  }
  if (report.reportedBy !== null && report.reportedBy === userId) {
    return true
  }
  return false
}

export function canUploadHazardAttachments(
  userId: number,
  userDepartman: string | null | undefined,
  report: { reportedBy: number | null; isAnonymous: boolean }
): boolean {
  if (canViewAllHazardReports(userDepartman)) {
    return true
  }
  if (report.isAnonymous) {
    return false
  }
  return report.reportedBy === userId
}
