export type SnapshotItem = { label: string; sortOrder: number; isRequired?: boolean }

export function mapSnapshotItems(items: SnapshotItem[]) {
  return items.map((it) => ({
    label: it.label,
    sortOrder: it.sortOrder,
    isRequired: it.isRequired !== false,
  }))
}
