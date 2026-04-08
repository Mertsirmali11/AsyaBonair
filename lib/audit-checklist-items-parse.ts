export type ParsedChecklistItem = {
  label: string
  sortOrder: number
  reference: string | null
  section: string | null
}

export function parseAuditChecklistItemsFromBody(itemsRaw: unknown): ParsedChecklistItem[] {
  const arr = Array.isArray(itemsRaw) ? itemsRaw : []
  return arr
    .map((row, idx) => {
      if (!row || typeof row !== "object") return null
      const r = row as Record<string, unknown>
      const label = typeof r.label === "string" ? r.label.trim() : ""
      if (!label) return null
      const sortOrder =
        typeof r.sortOrder === "number" && Number.isFinite(r.sortOrder)
          ? Math.trunc(r.sortOrder)
          : idx
      const reference =
        typeof r.reference === "string" && r.reference.trim()
          ? r.reference.trim().slice(0, 500)
          : null
      const section =
        typeof r.section === "string" && r.section.trim()
          ? r.section.trim().slice(0, 400)
          : null
      return {
        label: label.slice(0, 8000),
        sortOrder,
        reference,
        section,
      }
    })
    .filter(Boolean) as ParsedChecklistItem[]
}
