"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { RefreshCw, Settings2, Search, ArrowLeft, Ban } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ShgmCategoryKey } from "@/lib/shgm/categories"
import { mergeDepartmentLists } from "@/lib/organization-departments"

export type ShgmRegulationRow = {
  id: number
  title: string
  category: string
  /** lib/shgm/categories.ts#getShgmRegulationType ile türetilmiş — DB'de ayrı kolon değil. */
  typeKey: string
  typeLabel: string
  department: string | null
  /** new | reviewed — mevcut okundu/okunmadı mekanizması, değiştirilmedi. */
  status: string
  /** En son revizyon olayının türü: created | revised. */
  latestEventKind: string
  publishDate: string | null
  latestRevisionNo: string | null
  latestRevisionDate: string | null
  sourceUrl: string
  revisionCount: number
}

type CategoryDefault = { category: string; department: string }

type QuickFilter = "all" | "new" | "revised" | "removed"

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Tüm Mevzuat" },
  { key: "new", label: "Yeni Yayınlananlar" },
  { key: "revised", label: "Revize Edilenler" },
  { key: "removed", label: "Kaldırılanlar" },
]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("tr-TR")
  } catch {
    return "—"
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

/** Durum rozeti — mevcut new/reviewed okundu mekanizmasını korur, üstüne Yeni Yayın/Revize/Kaldırıldı ayrımını ekler. */
function StatusBadge({ row }: { row: ShgmRegulationRow }) {
  if (row.status === "reviewed") {
    return <Badge variant="outline">İncelendi</Badge>
  }
  if (row.category === "kaldirilan") {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        <Ban className="size-3" />
        Kaldırıldı
      </Badge>
    )
  }
  if (row.latestEventKind === "revised") {
    return <Badge variant="secondary">Revize</Badge>
  }
  return <Badge>Yeni Yayın</Badge>
}

function matchesQuickFilter(row: ShgmRegulationRow, filter: QuickFilter): boolean {
  switch (filter) {
    case "all":
      return true
    case "removed":
      return row.category === "kaldirilan"
    case "new":
      return row.status === "new" && row.latestEventKind === "created"
    case "revised":
      return row.status === "new" && row.latestEventKind === "revised"
  }
}

export function ShgmMevzuatClient({
  initialRows,
  categoryLabels,
  initialCategoryDefaults,
  registeredDepartments,
}: {
  initialRows: ShgmRegulationRow[]
  categoryLabels: Record<ShgmCategoryKey, string>
  initialCategoryDefaults: CategoryDefault[]
  registeredDepartments: string[]
}) {
  const [rows, setRows] = React.useState(initialRows)
  const [search, setSearch] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all")
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("all")
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)
  const [defaults, setDefaults] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const d of initialCategoryDefaults) map[d.category] = d.department
    return map
  })
  const [savingDefaults, setSavingDefaults] = React.useState(false)

  const departmentOptions = React.useMemo(
    () =>
      mergeDepartmentLists(
        registeredDepartments,
        rows.map((r) => r.department).filter((d): d is string => Boolean(d))
      ),
    [registeredDepartments, rows]
  )

  const departmentFilteredRows = React.useMemo(
    () =>
      departmentFilter === "all"
        ? rows
        : rows.filter(
            (r) => (r.department ?? "").trim().toLowerCase() === departmentFilter.toLowerCase()
          ),
    [rows, departmentFilter]
  )

  const typeCards = React.useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; label: string; total: number; newCount: number; revisedCount: number }
    >()
    for (const r of departmentFilteredRows) {
      let bucket = byKey.get(r.typeKey)
      if (!bucket) {
        bucket = { key: r.typeKey, label: r.typeLabel, total: 0, newCount: 0, revisedCount: 0 }
        byKey.set(r.typeKey, bucket)
      }
      bucket.total += 1
      if (r.status === "new") {
        if (r.latestEventKind === "revised") bucket.revisedCount += 1
        else bucket.newCount += 1
      }
    }
    const all = [...byKey.values()]
    const removed = all.filter((c) => c.key === "kaldirilan")
    const rest = all
      .filter((c) => c.key !== "kaldirilan")
      .sort((a, b) => b.total - a.total)
    return [...rest, ...removed]
  }, [departmentFilteredRows])

  const isBrowsing = search.trim().length === 0 && quickFilter === "all" && selectedType === null

  const listRows = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr")
    return departmentFilteredRows.filter((r) => {
      if (selectedType && r.typeKey !== selectedType) return false
      if (!matchesQuickFilter(r, quickFilter)) return false
      if (!q) return true
      const haystack = [
        r.title,
        r.typeLabel,
        categoryLabels[r.category as ShgmCategoryKey] ?? r.category,
        r.department ?? "",
        r.latestRevisionNo ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr")
      return haystack.includes(q)
    })
  }, [departmentFilteredRows, selectedType, quickFilter, search, categoryLabels])

  function openType(key: string) {
    setSelectedType(key)
    setQuickFilter("all")
  }

  function selectQuickFilter(key: QuickFilter) {
    setQuickFilter(key)
    setSelectedType(null)
  }

  function backToPortal() {
    setSelectedType(null)
    setQuickFilter("all")
    setSearch("")
  }

  async function markReviewed(id: number) {
    const res = await fetch(`/api/shgm-mevzuat/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    })
    if (!res.ok) {
      toast.error("İşlem başarısız oldu.")
      return
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "reviewed" } : r))
    )
    toast.success("İncelendi olarak işaretlendi.")
  }

  async function runSyncNow() {
    setSyncing(true)
    try {
      const res = await fetch("/api/shgm-mevzuat/sync", { method: "POST" })
      const data = (await parseJson(res)) as
        | { created: number; revised: number; scrapeErrors: { url: string; error: string }[] }
        | { error: string }
        | null
      if (!res.ok || !data || "error" in data) {
        toast.error(
          data && "error" in data ? data.error : "Tarama başarısız oldu."
        )
        return
      }
      toast.success(
        `Tarama tamamlandı: ${data.created} yeni, ${data.revised} revizyon.` +
          (data.scrapeErrors.length > 0
            ? ` (${data.scrapeErrors.length} sayfa okunamadı)`
            : "")
      )
      window.location.reload()
    } catch {
      toast.error("Tarama sırasında hata oluştu.")
    } finally {
      setSyncing(false)
    }
  }

  async function saveDefaults() {
    setSavingDefaults(true)
    try {
      for (const category of Object.keys(categoryLabels)) {
        const department = (defaults[category] ?? "").trim()
        if (!department) continue
        await fetch("/api/shgm-mevzuat/category-defaults", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, department }),
        })
      }
      toast.success("Varsayılan departmanlar kaydedildi.")
    } catch {
      toast.error("Kaydedilemedi.")
    } finally {
      setSavingDefaults(false)
    }
  }

  const currentTypeLabel = selectedType
    ? typeCards.find((c) => c.key === selectedType)?.label ?? selectedType
    : null

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">SHGM Mevzuat Portalı</h1>
          <p className="text-sm text-muted-foreground">
            SHGM mevzuat portalından takip edilen yayım ve revizyonlar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="size-4" />
                Varsayılan Departmanlar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Kategori → Varsayılan Departman</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm">{label}</span>
                    <Input
                      value={defaults[key] ?? ""}
                      onChange={(e) =>
                        setDefaults((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="ör. Kalite"
                    />
                  </div>
                ))}
                <Button onClick={saveDefaults} disabled={savingDefaults} className="mt-2">
                  {savingDefaults ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={runSyncNow} disabled={syncing} size="sm">
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            {syncing ? "Taranıyor…" : "Şimdi Tara"}
          </Button>
        </div>
      </div>

      {/* Büyük arama alanı */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Mevzuat, kod veya başlık ara..."
          className="h-12 rounded-xl pl-11 text-base"
        />
      </div>

      {/* Hızlı filtreler + departman filtresi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={quickFilter === f.key && !selectedType ? "default" : "outline"}
              onClick={() => selectQuickFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm shrink-0">İlgili Departman</span>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue placeholder="Tüm departmanlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm departmanlar</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isBrowsing ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {typeCards.map((card) => (
            <Card
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => openType(card.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openType(card.key)
              }}
              className={cn(
                "cursor-pointer gap-2 py-5 px-5 transition-colors hover:border-primary/60 hover:bg-accent/40",
                card.key === "kaldirilan" && "opacity-90"
              )}
            >
              <p className="font-semibold leading-tight">{card.label}</p>
              <p className="text-muted-foreground text-sm">{card.total} kayıt</p>
              {(card.newCount > 0 || card.revisedCount > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {card.newCount > 0 && <Badge>{card.newCount} Yeni</Badge>}
                  {card.revisedCount > 0 && (
                    <Badge variant="secondary">{card.revisedCount} Revize</Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
          {typeCards.length === 0 && (
            <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
              Kayıt bulunamadı.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={backToPortal} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Portale dön
            </Button>
            <span className="text-muted-foreground text-sm">
              {currentTypeLabel ??
                QUICK_FILTERS.find((f) => f.key === quickFilter)?.label ??
                "Tümü"}
              {search.trim() ? ` · "${search.trim()}" için arama` : ""}
              {" · "}
              {listRows.length} kayıt
            </span>
          </div>

          <div className="rounded-lg border">
            <ScrollArea className="h-[min(65vh,700px)]">
              {/* containerClassName: Table'ın kendi overflow-x-auto sarmalayıcısı bilerek
                  verilmiyor — ScrollArea'nın Viewport'u hem x hem y scroll'u tek elemanda
                  yönetiyor; ayrı bir iç overflow-x-auto div sticky header'ı kırar (bkz.
                  components/ui/table.tsx Table containerClassName açıklaması). */}
              <Table containerClassName="relative w-full">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Durum</TableHead>
                  <TableHead>Mevzuat Adı</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Yayım Tarihi</TableHead>
                  <TableHead>Son Revizyon</TableHead>
                  <TableHead>Revizyon / Değişiklik No</TableHead>
                  <TableHead>İlgili Departman</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                      Kayıt bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  listRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <StatusBadge row={r} />
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <Link
                          href={`/compliance/shgm-mevzuat/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.title}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          {r.revisionCount} kayıt
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.typeLabel}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(r.publishDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(r.latestRevisionDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.latestRevisionNo ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.department ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "new" ? (
                          <Button size="sm" variant="outline" onClick={() => markReviewed(r.id)}>
                            İncelendi
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}
