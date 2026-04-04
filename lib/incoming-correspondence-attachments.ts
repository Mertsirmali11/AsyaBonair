import { OUTGOING_PDF_MAX_TOTAL_BYTES } from "@/lib/outgoing-correspondence-attachments"

export type IncomingStoredAttachment = { path: string; fileName: string }

export const INCOMING_PDF_MAX_TOTAL_BYTES = OUTGOING_PDF_MAX_TOTAL_BYTES

function isAttachment(x: unknown): x is IncomingStoredAttachment {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return typeof o.path === "string" && typeof o.fileName === "string"
}

export function getIncomingAttachmentsFromRow(row: {
  pdfAttachments?: unknown
  pdfPath: string | null
  pdfFileName: string | null
}): IncomingStoredAttachment[] {
  let raw: unknown = row.pdfAttachments
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      raw = undefined
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const list = raw.filter(isAttachment)
    if (list.length > 0) return list
    const pathStrings = raw.filter(
      (x): x is string => typeof x === "string" && x.length > 0
    )
    if (pathStrings.length > 0) {
      return pathStrings.map((path) => ({
        path,
        fileName: path.split("/").filter(Boolean).pop() ?? path,
      }))
    }
  }
  if (row.pdfPath && row.pdfFileName) {
    return [{ path: row.pdfPath, fileName: row.pdfFileName }]
  }
  return []
}

/** Build app URL for GET /api/incoming-papers/files/... */
export function incomingAttachmentProxyUrl(storagePath: string): string | null {
  const parts = storagePath.split("/").filter(Boolean)
  if (parts.length < 2) return null
  const paperNo = parts[0]
  const fileName = parts.slice(1).join("/")
  return `/api/incoming-papers/files/${paperNo}/${encodeURIComponent(fileName)}`
}

export { assignUniquePdfStorageNames } from "@/lib/outgoing-correspondence-attachments"
