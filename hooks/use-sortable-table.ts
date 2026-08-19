"use client"

import * as React from "react"

export type SortDirection = "asc" | "desc"

/**
 * Findings Follow Up / Audit Plan'da kurulan sortable-tablo davranışının
 * paylaşılan hali: ilk tıklama ASC, ikinci tıklama aynı kolona DESC, başka
 * bir kolona tıklama yeniden ASC'den başlar. Görsel taraf için
 * `components/ui/table.tsx` içindeki `SortableTableHead`'i kullanın — bu iki
 * parça birlikte, her sayfada ayrı sort state/ikon/karşılaştırma mantığı
 * yazmadan aynı deseni tekrar kullanmak içindir.
 */
export function useSortableTable<TColumn extends string>() {
  const [sortColumn, setSortColumn] = React.useState<TColumn | null>(null)
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc")

  const toggleSort = React.useCallback((column: TColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("asc")
      return column
    })
  }, [])

  return { sortColumn, sortDir, toggleSort } as const
}

/**
 * Filtrelenmiş satırları verilen sütuna göre sıralar — filtre/arama ÖNCE
 * uygulanmış listeyi buraya verin (bkz. çağıran taraftaki filtered/sorted
 * ayrımı). `keyFor` null dönerse o satır sıralama yönünden BAĞIMSIZ olarak
 * sona atılır (boş/eksik değerler her zaman en altta). Sayısal anahtarlar
 * doğrudan çıkarılır; metin anahtarlar Türkçe + sayı-duyarlı karşılaştırılır
 * (ör. "FUP-2" "FUP-10"'dan önce gelir).
 */
export function sortRowsBy<T, TColumn extends string>(
  rows: T[],
  sortColumn: TColumn | null,
  sortDir: SortDirection,
  keyFor: (row: T, column: TColumn) => string | number | null
): T[] {
  if (!sortColumn) return rows
  const withKey = rows.map((row) => ({ row, key: keyFor(row, sortColumn) }))
  withKey.sort((a, b) => {
    if (a.key === null && b.key === null) return 0
    if (a.key === null) return 1
    if (b.key === null) return -1
    const cmp =
      typeof a.key === "number" && typeof b.key === "number"
        ? a.key - b.key
        : String(a.key).localeCompare(String(b.key), "tr", { numeric: true, sensitivity: "base" })
    return sortDir === "asc" ? cmp : -cmp
  })
  return withKey.map((x) => x.row)
}
