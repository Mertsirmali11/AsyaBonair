/** Bölüm başlığı gösterimi (ardışık aynı bölümde tek şerit) */
export function effectiveSectionAt(items: { section: string }[], idx: number): string {
  let eff = ""
  for (let i = 0; i <= idx; i++) {
    const t = (items[i].section ?? "").trim()
    if (t) eff = t
  }
  return eff
}

export function showSectionHeader(items: { section: string }[], idx: number): boolean {
  const eff = effectiveSectionAt(items, idx)
  const prevEff = idx > 0 ? effectiveSectionAt(items, idx - 1) : ""
  return eff !== "" && eff !== prevEff
}

export type ChecklistExportRow = { section: string; reference: string; label: string }

export type ChecklistExportLine =
  | { kind: "section"; text: string }
  | { kind: "item"; num: number; reference: string; label: string }

export function buildChecklistExportLines(rows: ChecklistExportRow[]): ChecklistExportLine[] {
  const filtered = rows.filter((r) => r.label.trim().length > 0)
  const out: ChecklistExportLine[] = []
  let n = 0
  for (let i = 0; i < filtered.length; i++) {
    if (showSectionHeader(filtered, i)) {
      out.push({ kind: "section", text: effectiveSectionAt(filtered, i) })
    }
    n += 1
    out.push({
      kind: "item",
      num: n,
      reference: filtered[i].reference.trim() || "—",
      label: filtered[i].label.trim(),
    })
  }
  return out
}

export function sanitizeFilenamePart(s: string): string {
  return s
    .trim()
    .replace(/[^\w\u00C0-\u024f.-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "checklist"
}
