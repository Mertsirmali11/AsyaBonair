import { lowerExtension } from "@/lib/allowed-document-uploads"

/**
 * Storage'a yazılacak güvenli, benzersiz dosya adı üretir — orijinal (izinli) uzantıyı
 * KORUR. (Not: `assignUniqueDocumentStorageNamesFromNames` PDF/Word/Excel/PPT dışındaki
 * her uzantıyı sessizce ".pdf" yapan bir hataya sahip; Audit Response Files JPG/PNG/CSV/
 * TXT/ZIP de kabul ettiği için burada kullanılmıyor — bkz. ayrı bug-fix task'ı.)
 */
export function assignSafeUniqueFileNames(names: string[], allowedExt: ReadonlySet<string>): string[] {
  const used = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const ext = lowerExtension(name)
    const normalizedExt = ext && allowedExt.has(ext) ? ext : ""
    const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name
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
