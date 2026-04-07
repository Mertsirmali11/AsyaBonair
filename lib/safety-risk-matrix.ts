export type RiskMatrixTone = "green" | "yellow" | "red"

/** 5×5 risk matrisi — olasılık + şiddet koduna göre bant */
export function riskMatrixToneFromSelection(
  probability: number,
  severity: string
): RiskMatrixTone {
  const code = `${probability}${severity.toUpperCase()}`
  const green = new Set([
    "1E",
    "1D",
    "1C",
    "1B",
    "2E",
    "2D",
    "3E",
  ])
  const yellow = new Set([
    "1A",
    "2C",
    "2B",
    "2A",
    "3D",
    "3C",
    "3B",
    "4E",
    "4D",
    "4C",
    "5E",
    "5D",
  ])
  const red = new Set(["3A", "4B", "4A", "5C", "5B", "5A"])
  if (green.has(code)) return "green"
  if (yellow.has(code)) return "yellow"
  if (red.has(code)) return "red"
  return "yellow"
}

export function parseRiskLevelCode(
  raw: string
): { probability: number; severity: string } | null {
  const m = /^(\d)([EDCBA])$/i.exec(raw.trim())
  if (!m) return null
  const p = parseInt(m[1], 10)
  if (p < 1 || p > 5) return null
  return { probability: p, severity: m[2].toUpperCase() }
}

export function riskToneFromAssessmentString(
  initial: string
): RiskMatrixTone | null {
  const parsed = parseRiskLevelCode(initial)
  if (!parsed) return null
  return riskMatrixToneFromSelection(parsed.probability, parsed.severity)
}

export function riskBandLabel(tone: RiskMatrixTone): string {
  switch (tone) {
    case "green":
      return "Acceptable"
    case "yellow":
      return "Tolerable"
    case "red":
      return "Unacceptable"
  }
}

export function formatRiskAssessmentWithBand(
  probability: number,
  severity: string
): string {
  const sev = severity.toUpperCase()
  const tone = riskMatrixToneFromSelection(probability, sev)
  return `${probability}${sev} (${riskBandLabel(tone)})`
}

const FIRST_ASSESSMENT_CELL: Record<RiskMatrixTone, string> = {
  green:
    "border-emerald-700/30 bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white",
  yellow:
    "border-amber-600/40 bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
  red: "border-red-700/30 bg-red-600 text-white dark:bg-red-600 dark:text-white",
}

export function firstAssessmentCellClass(tone: RiskMatrixTone): string {
  return FIRST_ASSESSMENT_CELL[tone]
}
