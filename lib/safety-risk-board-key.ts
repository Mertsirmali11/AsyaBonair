/** Sunucu ve istemcide aynı risk anahtarı (localStorage + API). */
export const SAFETY_RISK_BOARD_KEY_MAX = 600

export function riskBoardKeyFromTitle(title: string): string {
  const t = title.trim()
  if (t.length <= SAFETY_RISK_BOARD_KEY_MAX) return t
  return t.slice(0, SAFETY_RISK_BOARD_KEY_MAX)
}
