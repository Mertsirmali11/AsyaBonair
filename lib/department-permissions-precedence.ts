import {
  orderedDepartmentPermissionKeys,
} from "@/lib/department-permission-keys"
import { legacyDepartmentPermission } from "@/lib/department-permissions-legacy"

export type ResolvedDepartmentPermissions = Record<string, boolean>

/**
 * Saf (DB'siz) precedence kuralı — Authorization matrisinin tek kaynağı: bir departman için
 * `DepartmentPermission` tablosunda EXPLICIT bir satır varsa (Açık veya Kapalı fark etmez) o
 * satır kazanır; yalnızca satır HİÇ yoksa (`rows` içinde o key için kayıt yok) legacy/varsayılan
 * kurala (`legacyDepartmentPermission`) düşülür. Legacy asla açık bir DB kaydını override etmez.
 *
 * Bilerek prisma/"server-only" bağımlılığı YOK — DB'ye dokunmadan izole test edilebilmesi için
 * (bkz. scripts/verify-department-permission-precedence.ts). DB'den satırları çeken asıl
 * fonksiyon lib/department-permissions-resolve.ts'te, bu saf fonksiyonu çağırır.
 */
export function resolveDepartmentPermissionsFromRows(
  rows: { permissionKey: string; allowed: boolean }[],
  departman: string | null | undefined
): ResolvedDepartmentPermissions {
  const keys = orderedDepartmentPermissionKeys()
  const byKey = new Map(rows.map((r) => [r.permissionKey, r.allowed]))
  const out: ResolvedDepartmentPermissions = {}
  for (const k of keys) {
    const explicit = byKey.get(k)
    out[k] = explicit !== undefined ? explicit : legacyDepartmentPermission(k, departman)
  }
  return out
}
