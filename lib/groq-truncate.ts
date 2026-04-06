/**
 * Groq ücretsiz / on_demand katmanı tek istekte düşük TPM (ör. ~12k token) ile sınırlı olabiliyor.
 * Çok uzun veya PDF’den bozuk çıkan metin bu sınırı aşıyor; girdiyi önceden kısaltırız.
 */
/** PDF’den bozuk/yoğun metin token başına daha pahalı olabildiği için ücretsiz TPM sınırına sığdırmak üzün tutuldu. */
export const GROQ_ANALYZE_MAX_INPUT_CHARS = 6_000

/** Sohbette şirket manueli gövdesi (önceki 120k yerine Groq ile uyumlu üst sınır). */
export const GROQ_MANUAL_CONTEXT_MAX_CHARS = 12_000

export function truncateForGroqAnalyze(text: string): {
  text: string
  truncated: boolean
} {
  const max = GROQ_ANALYZE_MAX_INPUT_CHARS
  const t = text.trim()
  if (t.length <= max) {
    return { text: t, truncated: false }
  }
  return {
    text:
      t.slice(0, max) +
      `\n\n[… Metin ücretsiz API sınırı için ${max.toLocaleString("tr-TR")} karakterde kesildi. Tam metin için parçalara bölerek analiz edin veya Groq tarafında limiti yükseltin. …]`,
    truncated: true,
  }
}
