/** Kullanıcı yönetimindeki "Admin" departmanı — genişletilmiş uygulama yetkileri + manuel arşivi. */
export function isAdminDepartment(
  departman: string | null | undefined
): boolean {
  return (departman ?? "").trim().toLowerCase() === "admin"
}

/** HR / Quality / Admin — yapılandırma, kullanıcı ayarları, yazışmalar vb. tam erişim. */
export function canAccessConfigurationsArea(
  departman: string | null | undefined
): boolean {
  return (
    isAdminDepartment(departman) ||
    departman === "Human Resources" ||
    departman === "Quality"
  )
}

/** Objectives / custom report types (Configurations → Safety settings). */
export function canAccessQualityOrAdminSettings(
  departman: string | null | undefined
): boolean {
  return departman === "Quality" || isAdminDepartment(departman)
}

/**
 * Who may open **Configurations → New worker** and approve/reject self-service registrations.
 * Override with `WORKER_REGISTRATION_APPROVER_DEPARTMENTS` (comma-separated department names).
 * If unset, defaults to the same departments as configurations (HR + Quality + Admin).
 */
export function canApproveWorkerRegistrations(
  departman: string | null | undefined
): boolean {
  if (isAdminDepartment(departman)) return true
  const raw = process.env.WORKER_REGISTRATION_APPROVER_DEPARTMENTS?.trim()
  if (raw) {
    const allowed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return !!departman && allowed.includes(departman)
  }
  return canAccessConfigurationsArea(departman)
}
