import "server-only"

import { parseOffice } from "officeparser"

import { extractTextFromPdfBuffer } from "@/lib/extract-pdf-text"

const MAX_CHARS = 500_000

function truncateText(text: string): { text: string; truncated: boolean } {
  const raw = text.trim()
  if (raw.length <= MAX_CHARS) {
    return { text: raw, truncated: false }
  }
  return {
    text: `${raw.slice(0, MAX_CHARS)}\n\n[… metin ${MAX_CHARS.toLocaleString("tr-TR")} karakterde kesildi …]`,
    truncated: true,
  }
}

/**
 * PDF için mevcut çıkarıcı; diğer ofis formatları için officeparser (DOCX, XLSX, PPTX, …).
 */
export async function extractPlainTextFromUploadedDocument(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; truncated: boolean }> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) {
    return extractTextFromPdfBuffer(buffer)
  }

  try {
    const ast = await parseOffice(buffer)
    const raw = (ast.toText?.() ?? "").trim()
    if (!raw) {
      return { text: "", truncated: false }
    }
    return truncateText(raw)
  } catch (e) {
    console.error("[extractPlainTextFromUploadedDocument]", fileName, e)
    throw e
  }
}
