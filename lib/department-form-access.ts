import { isAdminDepartment } from "@/lib/department-access"

/** Yalnızca Admin — tüm departman formlarını görür / her departman adına yükleyebilir. */
export function canManageAllDepartmentForms(
  departman: string | null | undefined
): boolean {
  return isAdminDepartment(departman)
}

export function normalizeDeptLabel(
  departman: string | null | undefined
): string {
  return (departman ?? "").trim()
}

/**
 * Formlar API’si için: JWT’de Admin görünürken veritabanında farklı veya boş
 * departman kaydı olabiliyor; duyuru tarafındaki «önce DB» kuralı burada yükseltilmiş
 * oturum rolünü ezmemeli.
 */
export function effectiveDepartmanForDepartmentForms(
  dbValue: string | null | undefined,
  sessionValue: string | null | undefined
): string | null {
  const db = normalizeDeptLabel(dbValue)
  const ses = normalizeDeptLabel(sessionValue)
  if (canManageAllDepartmentForms(ses)) return ses.length > 0 ? ses : null
  if (canManageAllDepartmentForms(db)) return db.length > 0 ? db : null
  if (db.length > 0) return db
  if (ses.length > 0) return ses
  return null
}

/** Görüntüleme: yönetici veya satırın departmanı kullanıcıyla aynı. */
export function canViewDepartmentFormRow(
  viewerDept: string | null | undefined,
  formDepartment: string
): boolean {
  if (canManageAllDepartmentForms(viewerDept)) return true
  return normalizeDeptLabel(viewerDept) === normalizeDeptLabel(formDepartment)
}

/** Düzenleme / yükleme / arşiv / silme — yalnızca satırın departmanı veya Admin. */
export function canWriteDepartmentForm(
  viewerDept: string | null | undefined,
  formDepartment: string
): boolean {
  return canViewDepartmentFormRow(viewerDept, formDepartment)
}
