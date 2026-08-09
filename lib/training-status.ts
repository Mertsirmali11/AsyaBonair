/** Süresi dolmuş sertifika takibiyle (30 gün) tutarlı pencere. */
export const TRAINING_EXPIRING_SOON_DAYS = 30

export type TrainingStatus = "valid" | "expiring" | "expired" | "no-expiry"

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  valid: "Geçerli",
  expiring: "Yenileme Yaklaşıyor",
  expired: "Süresi Geçmiş",
  "no-expiry": "Süresiz",
}

function toUtcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Kalan/geçen gün sayısı — pozitif: kalan gün, negatif: geçen gün. */
export function daysUntil(expiryDate: Date, today: Date = new Date()): number {
  return Math.round((toUtcDayMs(expiryDate) - toUtcDayMs(today)) / 86_400_000)
}

export function computeTrainingStatus(
  expiryDate: Date | null,
  today: Date = new Date()
): TrainingStatus {
  if (!expiryDate) return "no-expiry"
  const remaining = daysUntil(expiryDate, today)
  if (remaining < 0) return "expired"
  if (remaining <= TRAINING_EXPIRING_SOON_DAYS) return "expiring"
  return "valid"
}
