/**
 * Configurations → Departmanlar (custom_departments.name) zamanla değişebiliyor
 * (örn. bir departman yeniden adlandırılabiliyor), ama `DepartmentForm.department`
 * gibi alanlar yükleme anındaki metni kopyalayıp saklıyor — isim sonradan değişince
 * eski kayıtlar eski metinle kalıyor.
 *
 * Tespit edilen sapma (read-only DB incelemesi, 2026-08-19): `custom_departments`
 * içinde kayıtlı ad "Crew Training Department" iken, department_forms
 * tablosundaki 31 kayıt hâlâ eski adı ("Crew Training") taşıyor. Başka hiçbir
 * departman için sapma yok (Compliance Monitoring Department ve Ground
 * Operations Department kayıtları zaten canonical isimle uyumlu); department_procedures
 * tablosu şu an boş.
 *
 * Departman metni karşılaştıran HER yer (liste filtresi, API sorgusu, yazma
 * izni kontrolü, upload prefill) bu dosyadaki fonksiyonları kullanmalı — ayrı
 * ayrı `a === b` / `a === b.toLowerCase()` yazılmamalı. Client ve server'da
 * ortak kullanılabilsin diye bu dosyanın hiçbir importu / "server-only" işareti
 * yoktur; env değişkeni okumaz.
 */
export const LEGACY_DEPARTMENT_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Crew Training Department": ["Crew Training"],
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

/** `name` + varsa bilinen eski (legacy) karşılıkları — ham metinler (normalize edilmemiş). */
export function departmentNameVariants(name: string | null | undefined): string[] {
  const t = (name ?? "").trim()
  if (!t) return []
  const aliases = LEGACY_DEPARTMENT_NAME_ALIASES[t] ?? []
  return [t, ...aliases]
}

/**
 * İki departman metni — case/whitespace farkı ve bilinen eski adlar dahil —
 * aynı departmanı mı gösteriyor?
 */
export function departmentNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const at = normalize(a)
  const bt = normalize(b)
  if (!at || !bt) return false
  if (at === bt) return true
  if (departmentNameVariants(a).some((v) => normalize(v) === bt)) return true
  return departmentNameVariants(b).some((v) => normalize(v) === at)
}

/**
 * `raw` metnini kayıtlı (canonical) departman listesindeki karşılığına çözer.
 * Eşleşme yoksa `raw`'ı olduğu gibi döner (veri kaybı / sessiz üzerine yazma olmasın diye).
 */
export function resolveCanonicalDepartmentName(
  raw: string | null | undefined,
  registry: readonly string[]
): string {
  const t = (raw ?? "").trim()
  if (!t) return t
  const exact = registry.find((d) => d === t)
  if (exact) return exact
  const aliasMatch = registry.find((d) => departmentNamesMatch(d, t))
  return aliasMatch ?? t
}
