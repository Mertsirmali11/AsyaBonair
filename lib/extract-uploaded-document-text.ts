import "server-only"

import { randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

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
 *
 * officeparser'a ham Buffer verilirse dosya türünü bizim bildiğimiz uzantıyı hiç
 * kullanmadan, yalnızca "magic byte" sezgisiyle (file-type paketi) tahmin ediyor —
 * bu tahmin bazı gerçek Word/Excel/PowerPoint dosyalarında başarısız olup
 * "metne çevrilemedi" hatasına yol açabiliyor. Bunun yerine dosyayı GERÇEK
 * uzantısıyla geçici bir dosyaya yazıp officeparser'a yol (path) veriyoruz;
 * bu durumda uzantıya güvenir, sezgiye ihtiyaç duymaz.
 */
export async function extractPlainTextFromUploadedDocument(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; truncated: boolean }> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) {
    return extractTextFromPdfBuffer(buffer)
  }

  const ext = path.extname(fileName) || ".docx"
  const tmpDir = await mkdtemp(path.join(tmpdir(), "office-extract-"))
  const tmpPath = path.join(tmpDir, `${randomUUID()}${ext}`)
  try {
    await writeFile(tmpPath, buffer)
    const ast = await parseOffice(tmpPath)
    const raw = (ast.toText?.() ?? "").trim()
    if (!raw) {
      return { text: "", truncated: false }
    }
    return truncateText(raw)
  } catch (e) {
    console.error("[extractPlainTextFromUploadedDocument]", fileName, e)
    throw e
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
