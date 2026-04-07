import { riskBoardKeyFromTitle } from "@/lib/safety-risk-board-key"

const TASK_BOARD_SNAPSHOT_PREFIX = "asyabonair:task-board:v1:"

function localSnapshotKeyForRiskTitle(riskTitle: string): string {
  const rk = riskBoardKeyFromTitle(riskTitle)
  return `${TASK_BOARD_SNAPSHOT_PREFIX}${encodeURIComponent(rk)}`
}

/** Tarayıcıda kayıtlı task board snapshot’ından olasılık + şiddet (Risk Board ile senkron için). */
export function readLocalRiskBoardAssessment(
  riskTitle: string
): { probability: number; severity: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(localSnapshotKeyForRiskTitle(riskTitle))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      v?: unknown
      probability?: unknown
      severity?: unknown
    }
    if (parsed?.v !== 1) return null
    const p = parsed.probability
    const s = parsed.severity
    if (typeof p !== "number" || p < 1 || p > 5) return null
    if (typeof s !== "string" || !/^[EDCBA]$/i.test(s)) return null
    return { probability: p, severity: s.toUpperCase() }
  } catch {
    return null
  }
}

export function assessmentCodeFromParts(
  probability: number,
  severity: string
): string {
  return `${probability}${severity.toUpperCase()}`
}
