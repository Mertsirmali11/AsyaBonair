export type OutgoingStoredAttachment = { path: string; fileName: string }

export const OUTGOING_PDF_MAX_TOTAL_BYTES = 50 * 1024 * 1024

function isAttachment(x: unknown): x is OutgoingStoredAttachment {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return typeof o.path === "string" && typeof o.fileName === "string"
}

export function getOutgoingAttachmentsFromRow(row: {
  pdfAttachments?: unknown
  pdfPath: string | null
  pdfFileName: string | null
}): OutgoingStoredAttachment[] {
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

/** Build app URL for GET /api/outgoing-correspondences/files/... */
export function outgoingAttachmentProxyUrl(storagePath: string): string | null {
  const parts = storagePath.split("/").filter(Boolean)
  if (parts.length < 3 || parts[0] !== "outgoing") return null
  const paperNo = parts[1]
  const fileName = parts.slice(2).join("/")
  return `/api/outgoing-correspondences/files/${paperNo}/${encodeURIComponent(fileName)}`
}

export {
  assignUniqueDocumentStorageNames as assignUniquePdfStorageNames,
} from "@/lib/allowed-document-uploads"
