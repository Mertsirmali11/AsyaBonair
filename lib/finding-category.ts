/**
 * SACA/SAFA denetimlerinde Finding Category (CAT1/CAT2/CAT3) — mevcut findingLevel
 * (Level1/Level2/Observation) workflow'undan bağımsız, ek sınıflandırma alanı.
 * Yalnızca SACA ve SAFA audit type'larında kullanılır; diğer tüm audit type'larında
 * (Internal, External, vb.) mevcut finding classification değişmeden çalışmaya devam eder.
 */

export const FINDING_CATEGORY_VALUES = ["CAT1", "CAT2", "CAT3"] as const
export type FindingCategoryValue = (typeof FINDING_CATEGORY_VALUES)[number]

export const findingCategoryLabels: Record<FindingCategoryValue, string> = {
  CAT1: "CAT 1",
  CAT2: "CAT 2",
  CAT3: "CAT 3",
}

export const findingCategoryStyles: Record<FindingCategoryValue, string> = {
  CAT1: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  CAT2: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  CAT3: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
}

/** Audit kategori adı (AuditCategoryType.name) SACA veya SAFA mı? */
export function isSacaOrSafaAuditCategory(categoryName: string | null | undefined): boolean {
  const n = (categoryName ?? "").trim().toUpperCase()
  return n === "SACA" || n === "SAFA"
}

/**
 * "Field" metni (kategori — alt kategori, örn. "SACA — Documentation") üzerinden
 * SACA/SAFA denetimi mi kontrolü — audit-session-client gibi yalnızca birleşik field
 * metnine erişimi olan ekranlarda kullanılır.
 */
export function isSacaOrSafaField(field: string | null | undefined): boolean {
  const n = (field ?? "").trim().toUpperCase()
  return n.startsWith("SACA") || n.startsWith("SAFA")
}

/**
 * Sunucu tarafında güvenli normalize: SACA/SAFA olmayan denetimlerde gelen değer ne
 * olursa olsun null'a zorlanır (client validasyonuna güvenilmez); SACA/SAFA'da ise
 * yalnızca CAT1/CAT2/CAT3 kabul edilir, aksi halde null.
 */
export function normalizeFindingCategory(
  value: unknown,
  categoryName: string | null | undefined
): FindingCategoryValue | null {
  if (!isSacaOrSafaAuditCategory(categoryName)) return null
  return typeof value === "string" && (FINDING_CATEGORY_VALUES as readonly string[]).includes(value)
    ? (value as FindingCategoryValue)
    : null
}
