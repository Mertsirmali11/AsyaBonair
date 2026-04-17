export type SnapshotItem = {
  label: string
  sortOrder: number
  isRequired?: boolean
  reference?: string | null
  section?: string | null
  isHeading?: boolean
}

export function mapSnapshotItems(items: SnapshotItem[]) {
  return items.map((it) => ({
    label: it.label,
    sortOrder: it.sortOrder,
    isRequired: it.isRequired !== false && !it.isHeading,
    reference: it.reference?.trim() ? it.reference.trim().slice(0, 500) : null,
    section: it.section?.trim() ? it.section.trim().slice(0, 400) : null,
    isHeading: it.isHeading ?? false,
  }))
}
