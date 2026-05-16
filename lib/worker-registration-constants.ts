import { normalizeDepartmentKey } from "@/lib/department-access"

/** Same limit as employee avatar uploads (21 MB). */
export const WORKER_REGISTRATION_PHOTO_MAX_BYTES = 21 * 1024 * 1024

/** Onay sırasında atanan departman tam olarak böyle ise pilot rütbesi sorulur. */
export function isPilotDepartmentName(departman: string | null | undefined): boolean {
  return normalizeDepartmentKey(departman) === "pilot"
}

export const PILOT_RANKS = ["Captain", "F/O"] as const

export const REGISTER_MARITAL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
] as const

export const REGISTER_BLOOD_TYPE_OPTIONS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "0+",
  "0-",
] as const

/** Education levels (English) — aligned with typical HR dropdowns */
export const REGISTER_EDUCATION_OPTIONS = [
  "Primary education",
  "Lower secondary",
  "Upper secondary / High school",
  "Vocational / Technical secondary",
  "Associate degree",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate (PhD)",
  "Other",
] as const
