/**
 * PDF, Word, Excel, PowerPoint uploads (correspondence, aircraft docs, AI, etc.).
 * Tarayıcı bazen `file.type` boş bırakır; uzantı ile de doğrularız.
 */

const EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
] as const

const MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

const ALLOWED_EXT = new Set<string>(EXTENSIONS)
const ALLOWED_MIME = new Set<string>(MIME_TYPES)

/** Departman formları — yalnızca Word, PDF, Excel (PowerPoint yok). */
const DEPARTMENT_FORM_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
] as const

const DEPARTMENT_FORM_EXT = new Set<string>(DEPARTMENT_FORM_EXTENSIONS)

const DEPARTMENT_FORM_MIME = new Set<string>(
  [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ].filter((m) => ALLOWED_MIME.has(m))
)

/** `input[type=file]` için `accept` özniteliği. */
export const DEPARTMENT_FORM_ACCEPT = [...DEPARTMENT_FORM_EXTENSIONS].join(",")

export const DEPARTMENT_FORM_TYPES_USER_MESSAGE =
  "PDF, Word (.doc, .docx) veya Excel (.xls, .xlsx)"

export const DOCUMENT_ACCEPT_HTML = [
  ...EXTENSIONS,
  ...MIME_TYPES,
].join(",")

export const ALLOWED_DOCUMENT_TYPES_USER_MESSAGE =
  "PDF, Word, Excel veya PowerPoint (.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx)"

export const ALLOWED_DOCUMENTS_ERROR_EN =
  "Allowed file types: PDF, Word, Excel, and PowerPoint."

export function lowerExtension(fileName: string): string | null {
  const lower = fileName.trim().toLowerCase()
  const i = lower.lastIndexOf(".")
  if (i < 0) return null
  return lower.slice(i)
}

export function isAllowedCorrespondenceDocumentFile(file: File): boolean {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime && ALLOWED_MIME.has(mime)) return true
  const ext = lowerExtension(file.name)
  return ext !== null && ALLOWED_EXT.has(ext)
}

/**
 * Gelen/Giden Evrak ekleri — yukarıdakine ek olarak taranmış görsel formatları
 * da kabul eder (PNG, JPG/JPEG). Yalnızca correspondence akışlarında kullanılır;
 * diğer modüllerin (manuals, aircraft docs, AI parse vb.) doğrulaması etkilenmez.
 */
const CORRESPONDENCE_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"] as const
const CORRESPONDENCE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const
const CORRESPONDENCE_EXT = new Set<string>([...ALLOWED_EXT, ...CORRESPONDENCE_IMAGE_EXTENSIONS])
const CORRESPONDENCE_MIME = new Set<string>([...ALLOWED_MIME, ...CORRESPONDENCE_IMAGE_MIME_TYPES])

export const CORRESPONDENCE_ACCEPT_HTML = [
  ...EXTENSIONS,
  ...CORRESPONDENCE_IMAGE_EXTENSIONS,
  ...MIME_TYPES,
  ...CORRESPONDENCE_IMAGE_MIME_TYPES,
].join(",")

export const CORRESPONDENCE_ALLOWED_TYPES_USER_MESSAGE =
  "PDF, Word, Excel, PowerPoint veya görsel (.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .png, .jpg, .jpeg)"

export const CORRESPONDENCE_ALLOWED_ERROR_EN =
  "Allowed file types: PDF, Word, Excel, PowerPoint, and images (PNG, JPG)."

export function isAllowedCorrespondenceDocumentOrImageFile(file: File): boolean {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime && CORRESPONDENCE_MIME.has(mime)) return true
  const ext = lowerExtension(file.name)
  return ext !== null && CORRESPONDENCE_EXT.has(ext)
}

export function isAllowedCorrespondenceDocumentOrImageFileName(fileName: string): boolean {
  const ext = lowerExtension(fileName)
  return ext !== null && CORRESPONDENCE_EXT.has(ext)
}

export function isAllowedDepartmentFormFile(file: File): boolean {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime && DEPARTMENT_FORM_MIME.has(mime)) return true
  const ext = lowerExtension(file.name)
  return ext !== null && DEPARTMENT_FORM_EXT.has(ext)
}

/**
 * Supabase veya HTTP yanıtları için dosya adından Content-Type.
 */
export function contentTypeFromFileName(fileName: string): string {
  const ext = lowerExtension(fileName)
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return "application/octet-stream"
}

/**
 * Yükleme sırasında `file.type` boşsa uzantıdan MIME üret.
 */
export function resolveDocumentMimeForUpload(file: File): string {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime && ALLOWED_MIME.has(mime)) return mime
  const ext = lowerExtension(file.name)
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return "application/octet-stream"
}

const CORRESPONDENCE_EXT_TO_MIME: Record<string, string> = {
  ...EXT_TO_MIME,
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
}

/** `resolveDocumentMimeForUpload` ile aynı, ama Gelen/Giden Evrak'ın kabul ettiği görselleri de tanır. */
export function resolveCorrespondenceMimeForUpload(file: File): string {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime && CORRESPONDENCE_MIME.has(mime)) return mime
  const ext = lowerExtension(file.name)
  if (ext && CORRESPONDENCE_EXT_TO_MIME[ext]) return CORRESPONDENCE_EXT_TO_MIME[ext]
  return "application/octet-stream"
}

/** Aynı isim (uzantı hariç) mantığı — hem File[] hem de sunucu tarafında sadece isimlerle çalışır. */
export function assignUniqueDocumentStorageNamesFromNames(names: string[]): string[] {
  const used = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const ext = lowerExtension(name)
    const normalizedExt =
      ext && ALLOWED_EXT.has(ext) ? ext : ".pdf"
    const base = name.includes(".")
      ? name.slice(0, name.lastIndexOf("."))
      : name
    const stem =
      base
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/\s+/g, "_") || "document"
    let candidate = `${stem}${normalizedExt}`
    let n = 0
    while (used.has(candidate)) {
      n += 1
      candidate = `${stem}_${n}${normalizedExt}`
    }
    used.add(candidate)
    result.push(candidate)
  }
  return result
}

export function assignUniqueDocumentStorageNames(files: File[]): string[] {
  return assignUniqueDocumentStorageNamesFromNames(files.map((f) => f.name))
}

/** Yalnızca dosya adına bakarak izinli türde mi (sunucu tarafı ön-doğrulama; henüz File nesnesi yoksa). */
export function isAllowedCorrespondenceDocumentFileName(fileName: string): boolean {
  const ext = lowerExtension(fileName)
  return ext !== null && ALLOWED_EXT.has(ext)
}
