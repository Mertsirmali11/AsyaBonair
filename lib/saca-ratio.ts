/**
 * SACA (Safety Assessment of Community Aircraft) Ratio — standart EASA
 * ağırlık katsayı algoritması. Bon Air'ın kendi uçaklarına yaptığı SACA
 * denetimleri (Denetim Planı → SACA kategorisi) üzerinden hesaplanır.
 *
 * Bulgu ağırlıkları: Category 1 (Minor) = 1, Category 2 (Significant) = 3,
 * Category 3 (Major) = 5.
 *
 * SACA Ratio = ((Cat1×1) + (Cat2×3) + (Cat3×5)) / Toplam Denetim Sayısı
 *
 * Uygulamadaki bulgu seviyeleri (Level 1 / Level 2 / Observation) EASA'nın
 * Category 1/2/3 skalasından farklı adlandırılmış — ciddiyet sırası ters:
 *   Level 1 (10 gün, en acil)  → Category 3 (Major)       — 5 puan
 *   Level 2 (90 gün)           → Category 2 (Significant) — 3 puan
 *   Observation (süre yok)     → Category 1 (Minor)        — 1 puan
 */

export const SACA_CAT_WEIGHTS = { cat1: 1, cat2: 3, cat3: 5 } as const

/** Denetim Planı bulgu seviyesi → SACA kategorisi eşleştirmesi. */
export function findingLevelToSacaCategory(findingLevel: string): "cat1" | "cat2" | "cat3" | null {
  switch (findingLevel) {
    case "Level1":
      return "cat3"
    case "Level2":
      return "cat2"
    case "Observation":
      return "cat1"
    default:
      return null
  }
}

/** EASA bölgesel ortalama referansı — sistemde varsayılan kıyaslama değeri. */
export const SACA_EU_AVERAGE_REFERENCE = 0.5

export type SacaThreshold = "good" | "watch" | "high-risk"

export const SACA_THRESHOLD_LABEL: Record<SacaThreshold, string> = {
  good: "İyi",
  watch: "Dikkat",
  "high-risk": "Yüksek Risk",
}

/** Toplam ağırlıklı bulgu puanı. */
export function sacaWeightedFindings(cat1: number, cat2: number, cat3: number): number {
  return cat1 * SACA_CAT_WEIGHTS.cat1 + cat2 * SACA_CAT_WEIGHTS.cat2 + cat3 * SACA_CAT_WEIGHTS.cat3
}

/** Denetim yoksa null (oran tanımsız). */
export function computeSacaRatio(
  cat1Total: number,
  cat2Total: number,
  cat3Total: number,
  totalInspections: number
): number | null {
  if (totalInspections <= 0) return null
  return sacaWeightedFindings(cat1Total, cat2Total, cat3Total) / totalInspections
}

/** <0.50 İyi, 0.50–0.80 Dikkat, >0.80 Yüksek Risk. */
export function sacaThreshold(ratio: number | null): SacaThreshold {
  if (ratio === null) return "good"
  if (ratio < 0.5) return "good"
  if (ratio <= 0.8) return "watch"
  return "high-risk"
}
