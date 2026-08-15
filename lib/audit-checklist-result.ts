/**
 * Checklist madde sonucu (S/U/NA/OBS) — tüm audit type'larında ortak, tek sınıflandırma.
 * Bu değerler "Denetim Yürüt" ekranı (audit-session-client.tsx) ve Public Audit Response
 * Link checklist formu (audit-response-public-client.tsx) tarafından PAYLAŞILIR — iki ayrı
 * sonuç listesi/hard-code YOKTUR. Checklist'in kendi `checklistType` alanı bugün yalnızca
 * tek bir değer ("Classic (Satisfactory/Unsatisfactory)") ile oluşturuluyor ve hiçbir yerde
 * bu sonuç kümesini dallandırmak için okunmuyor; ileride farklı bir checklist tipi eklenirse
 * bu dosya güncellenecek TEK yer burasıdır.
 */
export type ResultKey = "S" | "U" | "NA" | "OBS"

export const RESULT_KEYS: readonly ResultKey[] = ["S", "U", "NA", "OBS"] as const

export const RESULT_LABELS: Record<ResultKey, string> = {
  S: "Satisfactory",
  U: "Unsatisfactory",
  NA: "N/A",
  OBS: "Observation",
}

export function isResultKey(value: unknown): value is ResultKey {
  return typeof value === "string" && (RESULT_KEYS as readonly string[]).includes(value)
}
