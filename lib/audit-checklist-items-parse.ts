export type ParsedChecklistItem = {
  label: string
  sortOrder: number
  reference: string | null
  section: string | null
  isHeading: boolean
  /**
   * Stable id of the AuditChecklistItem row this entry corresponds to (present when the row
   * came from an already-persisted item, absent/null for a brand-new row created in the editor).
   * This is the ONLY signal callers should use to match an incoming row back to an existing DB
   * row — never positional/array-index matching, which silently reassigns content to the wrong
   * id once rows are inserted, removed, or reordered anywhere but the tail of the list.
   */
  existingId: number | null
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
      const isHeading = r.isHeading === true
      const existingId =
        typeof r.existingId === "number" &&
        Number.isInteger(r.existingId) &&
        r.existingId > 0
          ? r.existingId
          : null
      return {
        label: label.slice(0, 8000),
        sortOrder,
        reference,
        section,
        isHeading,
        existingId,
      }
    })
    .filter(Boolean) as ParsedChecklistItem[]
}
