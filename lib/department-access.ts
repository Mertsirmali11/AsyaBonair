export function canAccessConfigurationsArea(
  departman: string | null | undefined
): boolean {
  return departman === "Human Resources" || departman === "Quality"
}

/** Objectives / custom report types (Configurations → Safety settings). */
export function canAccessQualityOrAdminSettings(
  departman: string | null | undefined
): boolean {
  return departman === "Quality" || departman === "Admin"
}

/**
 * Who may open **Configurations → New worker** and approve/reject self-service registrations.
 * Override with `WORKER_REGISTRATION_APPROVER_DEPARTMENTS` (comma-separated department names).
 * If unset, defaults to the same departments as configurations (HR + Quality).
 */
export function canApproveWorkerRegistrations(
  departman: string | null | undefined
): boolean {
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
