/**
 * SAFA (Safety Assessment of Foreign Aircraft) Ratio — standart EASA ağırlık
 * katsayı algoritması.
 *
 * Bulgu ağırlıkları: Category 1 (Minor) = 1, Category 2 (Significant) = 3,
 * Category 3 (Major) = 5.
 *
 * SAFA Ratio = ((Cat1×1) + (Cat2×3) + (Cat3×5)) / Toplam Denetim Sayısı
 */

export const SAFA_CAT_WEIGHTS = { cat1: 1, cat2: 3, cat3: 5 } as const

/** EASA bölgesel ortalama referansı — sistemde varsayılan kıyaslama değeri. */
export const SAFA_EU_AVERAGE_REFERENCE = 0.5

export type SafaThreshold = "good" | "watch" | "high-risk"

export const SAFA_THRESHOLD_LABEL: Record<SafaThreshold, string> = {
  good: "İyi",
  watch: "Dikkat",
  "high-risk": "Yüksek Risk",
}

/** Toplam ağırlıklı bulgu puanı. */
export function safaWeightedFindings(cat1: number, cat2: number, cat3: number): number {
  return cat1 * SAFA_CAT_WEIGHTS.cat1 + cat2 * SAFA_CAT_WEIGHTS.cat2 + cat3 * SAFA_CAT_WEIGHTS.cat3
}

/** Denetim yoksa null (oran tanımsız). */
export function computeSafaRatio(
  cat1Total: number,
  cat2Total: number,
  cat3Total: number,
  totalInspections: number
): number | null {
  if (totalInspections <= 0) return null
  return safaWeightedFindings(cat1Total, cat2Total, cat3Total) / totalInspections
}

/** <0.50 İyi, 0.50–0.80 Dikkat, >0.80 Yüksek Risk. */
export function safaThreshold(ratio: number | null): SafaThreshold {
  if (ratio === null) return "good"
  if (ratio < 0.5) return "good"
  if (ratio <= 0.8) return "watch"
  return "high-risk"
}
