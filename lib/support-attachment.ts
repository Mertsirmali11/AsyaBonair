/** Masaüstü ekran görüntüsü + PDF (destek talebi ekleri). */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const ALLOWED_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
])

export const SUPPORT_ATTACHMENT_MAX_FILES = 5
export const SUPPORT_ATTACHMENT_MAX_BYTES_PER_FILE = 12 * 1024 * 1024 // 12 MB

function lowerExtension(name: string): string {
  const i = name.lastIndexOf(".")
  if (i < 0) return ""
  return name.slice(i).toLowerCase()
}

export function isAllowedSupportAttachmentFile(file: File): boolean {
  const mime = (file.type || "").trim().toLowerCase()
  if (mime === "application/pdf") return true
  if (mime.startsWith("image/") && ALLOWED_IMAGE_MIME.has(mime)) return true
  const ext = lowerExtension(file.name)
  return ALLOWED_EXT.has(ext)
}

export function resolveSupportAttachmentMime(file: File): string {
  const m = (file.type || "").trim().toLowerCase()
  if (m && (m === "application/pdf" || ALLOWED_IMAGE_MIME.has(m))) return m
  const ext = lowerExtension(file.name)
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  return "application/octet-stream"
}

export function sanitizeSupportAttachmentStorageBase(originalName: string): string {
  const base = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.\./g, "_")
  return base.length > 0 ? base : "file"
}
