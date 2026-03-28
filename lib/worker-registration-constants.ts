/** Same limit as employee avatar uploads (21 MB). */
export const WORKER_REGISTRATION_PHOTO_MAX_BYTES = 21 * 1024 * 1024

export const WORKER_REGISTRATION_DEPARTMENTS = [
  "Maintenance",
  "Human Resources",
  "Handling",
  "Camo",
  "Engineering",
  "Kitchen & Cleaning Staff",
  "Supply",
  "Accounting",
  "Quality",
  "Administrative Affairs",
  "IT",
  "Planning",
  "Pilot",
] as const

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
