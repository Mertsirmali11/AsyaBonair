export type SnapshotItem = {
  label: string
  sortOrder: number
  isRequired?: boolean
  reference?: string | null
  section?: string | null
}

export function mapSnapshotItems(items: SnapshotItem[]) {
  return items.map((it) => ({
    label: it.label,
    sortOrder: it.sortOrder,
    isRequired: it.isRequired !== false,
    reference: it.reference?.trim() ? it.reference.trim().slice(0, 500) : null,
    section: it.section?.trim() ? it.section.trim().slice(0, 400) : null,
  }))
}
