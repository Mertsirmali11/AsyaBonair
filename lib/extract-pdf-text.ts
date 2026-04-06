import "server-only"

const MAX_CHARS = 500_000

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{
  text: string
  truncated: boolean
}> {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy().catch(() => {})
  const raw = (result.text ?? "").trim()
  if (raw.length <= MAX_CHARS) {
    return { text: raw, truncated: false }
  }
  return {
    text: `${raw.slice(0, MAX_CHARS)}\n\n[… metin ${MAX_CHARS.toLocaleString("tr-TR")} karakterde kesildi …]`,
    truncated: true,
  }
}
