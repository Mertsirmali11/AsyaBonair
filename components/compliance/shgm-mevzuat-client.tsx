"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { RefreshCw, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { ShgmCategoryKey } from "@/lib/shgm/categories"

export type ShgmRegulationRow = {
  id: number
  title: string
  category: string
  department: string | null
  status: string
  publishDate: string | null
  latestRevisionNo: string | null
  latestRevisionDate: string | null
  sourceUrl: string
  revisionCount: number
}

type CategoryDefault = { category: string; department: string }

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

export function ShgmMevzuatClient({
  initialRows,
  categoryLabels,
  initialCategoryDefaults,
}: {
  initialRows: ShgmRegulationRow[]
  categoryLabels: Record<ShgmCategoryKey, string>
  initialCategoryDefaults: CategoryDefault[]
}) {
  const [rows, setRows] = React.useState(initialRows)
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [onlyNew, setOnlyNew] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [defaults, setDefaults] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const d of initialCategoryDefaults) map[d.category] = d.department
    return map
  })
  const [savingDefaults, setSavingDefaults] = React.useState(false)

  const filtered = rows.filter((r) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false
    if (onlyNew && r.status !== "new") return false
    return true
  })

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

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">SHGM Mevzuat</h1>
          <p className="text-sm text-muted-foreground">
            SHGM mevzuat portalından takip edilen yeni yayım ve revizyonlar.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
          <TabsList>
            <TabsTrigger value="all">Tümü</TabsTrigger>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant={onlyNew ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyNew((v) => !v)}
        >
          Yalnızca Yeni
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Durum</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Mevzuat</TableHead>
              <TableHead>Departman</TableHead>
              <TableHead>Son Revizyon</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={r.status === "new" ? "default" : "outline"}>
                      {r.status === "new" ? "Yeni" : "İncelendi"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {categoryLabels[r.category as ShgmCategoryKey] ?? r.category}
                  </TableCell>
                  <TableCell className="max-w-[420px]">
                    <Link
                      href={`/compliance/shgm-mevzuat/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.revisionCount} kayıt
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.department ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.latestRevisionNo ? `No: ${r.latestRevisionNo}` : "—"}
                    {r.latestRevisionDate ? ` · ${formatDate(r.latestRevisionDate)}` : ""}
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
      </div>
    </div>
  )
}
