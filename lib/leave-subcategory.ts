/** Prisma `LeaveRequestSubcategory` ile aynı değerler. */
export const LEAVE_SUBCATEGORY_VALUES = [
  "MAZERET_IZIN",
  "UCRETSIZ_IZIN",
  "YILLIK_UCRETLI_IZIN",
  "IDARI_IZIN",
] as const

export type LeaveSubcategory = (typeof LEAVE_SUBCATEGORY_VALUES)[number]

export const LEAVE_SUBCATEGORY_LABELS: Record<LeaveSubcategory, string> = {
  MAZERET_IZIN: "Mazeret izin",
  UCRETSIZ_IZIN: "Ücretsiz izin",
  YILLIK_UCRETLI_IZIN: "Yıllık ücretli izin",
  IDARI_IZIN: "İdari izin",
}

export function isLeaveSubcategory(v: string): v is LeaveSubcategory {
  return (LEAVE_SUBCATEGORY_VALUES as readonly string[]).includes(v)
}

export function leaveSubcategoryLabel(
  key: string | null | undefined
): string {
  if (!key || !isLeaveSubcategory(key)) return "—"
  return LEAVE_SUBCATEGORY_LABELS[key]
}
