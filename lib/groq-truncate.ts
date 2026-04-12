/**
 * Uzun PDF / metinler token sınırını aşmasın diye analiz ve sohbet öncesi kısaltma.
 */
export const GROQ_ANALYZE_MAX_INPUT_CHARS = 6_000

/** Sohbette şirket manueli gövdesi üst sınırı (Gemini bağlamı). */
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
      `\n\n[… Metin ${max.toLocaleString("tr-TR")} karakterde kesildi. Tam metin için parçalara bölerek analiz edin. …]`,
    truncated: true,
  }
}
