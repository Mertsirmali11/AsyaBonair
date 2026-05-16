/**
 * Kurum departmanları yalnızca `custom_departments` kayıtlarından gelir
 * (Configurations → Departmanlar). Sabit ürün listesi yoktur.
 */

type CustomDeptDelegate = {
  findMany(args: {
    orderBy: { name: "asc" }
    select: { name: true }
  }): Promise<{ name: string }[]>
}

/** Veritabanında kayıtlı departman adları (alfabetik). */
export async function fetchRegisteredDepartmentNames(prisma: {
  customDepartment: CustomDeptDelegate
}): Promise<string[]> {
  const rows = await prisma.customDepartment.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  })
  return rows.map((r) => r.name)
}

/** "Liste" modunda seçilen departman kayıtlı mı (büyük/küçük harf duyarsız)? */
export function isDepartmentInRegistry(
  value: string | null | undefined,
  registry: readonly string[]
): boolean {
  const t = (value ?? "").trim()
  if (!t) return false
  const lower = t.toLowerCase()
  return registry.some((r) => r.trim().toLowerCase() === lower)
}

/**
 * Kayıtlı departmanlar + çalışan kayıtlarında görünen ek isimler (henüz tabloya eklenmemiş olabilir)
 * — kullanıcı yönetimi filtreleri ve benzeri için.
 */
export function mergeDepartmentLists(
  configured: readonly string[],
  fromEmployees: string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    const k = t.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(t)
  }
  for (const c of configured) push(c)
  const extras: string[] = []
  for (const e of fromEmployees) {
    const t = e.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    extras.push(t)
  }
  extras.sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
  return [...out, ...extras]
}

const MAX_CUSTOM_MANUAL_DEPARTMENT_LEN = 100

/** Liste dışında serbest metin (manuel) — uzunluk ve kontrol karakterleri. */
export function isValidCustomManualDepartment(value: string | null | undefined): boolean {
  const t = (value ?? "").trim()
  if (t.length < 1 || t.length > MAX_CUSTOM_MANUAL_DEPARTMENT_LEN) return false
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t)
}
