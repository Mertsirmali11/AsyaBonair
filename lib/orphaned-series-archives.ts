/**
 * Seride güncel (isCurrent) kayıt kalmadığında arşivlenmiş revizyonlar
 * ana listede görünmez; yalnızca «Arşiv» bölümünde listelenir.
 */
export function orphanedArchiveSeriesFilter(activeSeriesIds: string[]) {
  const base = { isCurrent: false as const }
  if (activeSeriesIds.length === 0) return base
  return { ...base, seriesId: { notIn: activeSeriesIds } }
}
