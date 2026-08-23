/**
 * Departman alanındaki görünmez karakterleri (RTL işaretleri, NBSP) temizleyip küçük harfe çevirir.
 * Aksi halde veritabanında "Admin" görünüp string eşleşmeyebiliyor.
 */
export function normalizeDepartmentKey(
  departman: string | null | undefined
): string {
  return (departman ?? "")
    .replace(/[\u200e\u200f\u00a0]/g, "")
    .trim()
    .toLowerCase()
}

/** Kullanıcı yönetimindeki "Admin" departmanı — genişletilmiş uygulama yetkileri + manuel arşivi. */
export function isAdminDepartment(
  departman: string | null | undefined
): boolean {
  return normalizeDepartmentKey(departman) === "admin"
}

/**
 * Finding (Audit Findings / Findings Follow-up) için "TÜM bulguları gör" tam görünürlüğü —
 * bilerek `DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING` izninden AYRI ve daha DAR bir
 * kontrol: gerçek departman Admin veya Compliance Monitoring Department OLMALI. Bu izin
 * (Yetkilendirme ekranından) başka bir departmana (ör. CAMO'ya modül erişimi vermek için)
 * açılmış olabilir — bu TEK BAŞINA o departmanın kullanıcılarına başkalarının bulgularını
 * gösterme yetkisi VERMEZ. Bkz. lib/audit-finding-visibility.ts.
 */
export function isFullFindingVisibilityDepartment(
  departman: string | null | undefined
): boolean {
  const x = normalizeDepartmentKey(departman)
  return x === "admin" || x === "compliance monitoring department"
}

/** HR / Quality / Admin — yapılandırma, kullanıcı ayarları, yazışmalar vb. tam erişim. */
export function canAccessConfigurationsArea(
  departman: string | null | undefined
): boolean {
  const x = normalizeDepartmentKey(departman)
  return (
    x === "admin" ||
    x === "human resources" ||
    x === "quality"
  )
}

/** Objectives / custom report types (Configurations → Safety settings). */
export function canAccessQualityOrAdminSettings(
  departman: string | null | undefined
): boolean {
  const x = normalizeDepartmentKey(departman)
  return x === "quality" || x === "admin"
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
