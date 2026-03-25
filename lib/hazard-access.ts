export function canAccessHazardReport(
  userId: number,
  userDepartman: string | null | undefined,
  report: { reportedBy: number | null }
): boolean {
  if (userDepartman === "Quality" || userDepartman === "Human Resources") {
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
  if (userDepartman === "Quality" || userDepartman === "Human Resources") {
    return true
  }
  if (report.isAnonymous) {
    return false
  }
  return report.reportedBy === userId
}
