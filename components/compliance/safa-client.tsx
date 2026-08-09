"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  IconAlertTriangle,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateOnlyIstanbul } from "@/lib/date-format"
import {
  SAFA_EU_AVERAGE_REFERENCE,
  SAFA_THRESHOLD_LABEL,
  computeSafaRatio,
  safaThreshold,
  safaWeightedFindings,
  type SafaThreshold,
} from "@/lib/safa-ratio"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

export type SafaInspectionRow = {
  id: number
  inspectionDate: string
  location: string
  authority: string
  aircraftRegistration: string
  cat1Count: number
  cat2Count: number
  cat3Count: number
  notes: string | null
}

const THRESHOLD_CLASS: Record<SafaThreshold, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  watch: "text-amber-700 dark:text-amber-400",
  "high-risk": "text-red-700 dark:text-red-400",
}

const THRESHOLD_BADGE_CLASS: Record<SafaThreshold, string> = {
  good: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  watch: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  "high-risk": "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
}

const chartConfig = {
  ratio: {
    label: "SAFA Ratio",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function emptyForm() {
  return {
    inspectionDate: "",
    location: "",
    authority: "",
    aircraftRegistration: "",
    cat1Count: "0",
    cat2Count: "0",
    cat3Count: "0",
    notes: "",
  }
}

export function SafaClient({ initialRows }: { initialRows: SafaInspectionRow[] }) {
  const uid = React.useId()
  const [rows, setRows] = React.useState<SafaInspectionRow[]>(initialRows)
  const [loading, setLoading] = React.useState(false)

  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [registrationFilter, setRegistrationFilter] = React.useState("")
  const [authorityFilter, setAuthorityFilter] = React.useState("")

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [form, setForm] = React.useState(emptyForm())
  const [saving, setSaving] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<SafaInspectionRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      if (registrationFilter.trim()) params.set("registration", registrationFilter.trim())
      if (authorityFilter.trim()) params.set("authority", authorityFilter.trim())
      const res = await fetch(`/api/safa-inspections?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => [])) as SafaInspectionRow[]
      if (res.ok && Array.isArray(data)) setRows(data)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, registrationFilter, authorityFilter])

  React.useEffect(() => {
    const t = window.setTimeout(() => void reload(), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, registrationFilter, authorityFilter])

  // ── KPI hesaplamaları (görüntülenen/filtrelenmiş kayıtlar üzerinden) ──
  const totals = React.useMemo(() => {
    let cat1 = 0
    let cat2 = 0
    let cat3 = 0
    for (const r of rows) {
      cat1 += r.cat1Count
      cat2 += r.cat2Count
      cat3 += r.cat3Count
    }
    return { cat1, cat2, cat3, count: rows.length }
  }, [rows])

  const ratio = computeSafaRatio(totals.cat1, totals.cat2, totals.cat3, totals.count)
  const threshold = safaThreshold(ratio)

  // ── Trend grafiği: tarihe göre artan, her denetim noktasına kadar kümülatif ratio ──
  const chartData = React.useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.inspectionDate).getTime() - new Date(b.inspectionDate).getTime()
    )
    let cumCat1 = 0
    let cumCat2 = 0
    let cumCat3 = 0
    return sorted.map((r, i) => {
      cumCat1 += r.cat1Count
      cumCat2 += r.cat2Count
      cumCat3 += r.cat3Count
      const cumRatio = computeSafaRatio(cumCat1, cumCat2, cumCat3, i + 1)
      return {
        date: formatDateOnlyIstanbul(r.inspectionDate),
        ratio: cumRatio !== null ? Number(cumRatio.toFixed(3)) : 0,
      }
    })
  }, [rows])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  const openEdit = (r: SafaInspectionRow) => {
    setEditingId(r.id)
    setForm({
      inspectionDate: r.inspectionDate.slice(0, 10),
      location: r.location,
      authority: r.authority,
      aircraftRegistration: r.aircraftRegistration,
      cat1Count: String(r.cat1Count),
      cat2Count: String(r.cat2Count),
      cat3Count: String(r.cat3Count),
      notes: r.notes ?? "",
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.inspectionDate) {
      toast.error("Denetim tarihi gerekli.")
      return
    }
    if (!form.location.trim()) {
      toast.error("Denetim yeri / havalimanı gerekli.")
      return
    }
    if (!form.authority.trim()) {
      toast.error("Denetleyen otorite gerekli.")
      return
    }
    if (!form.aircraftRegistration.trim()) {
      toast.error("Uçak tescili gerekli.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        inspectionDate: form.inspectionDate,
        location: form.location.trim(),
        authority: form.authority.trim(),
        aircraftRegistration: form.aircraftRegistration.trim().toUpperCase(),
        cat1Count: Number(form.cat1Count) || 0,
        cat2Count: Number(form.cat2Count) || 0,
        cat3Count: Number(form.cat3Count) || 0,
        notes: form.notes.trim() || null,
      }
      const url = editingId === null ? "/api/safa-inspections" : `/api/safa-inspections/${editingId}`
      const res = await fetch(url, {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.")

      toast.success(editingId === null ? "Denetim kaydı oluşturuldu." : "Kayıt güncellendi.")
      setFormOpen(false)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/safa-inspections/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Kayıt silindi.")
      setDeleteTarget(null)
      await reload()
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <SetWorkspacePageTitle title="SAFA Score" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SAFA Score</h1>
          <p className="text-muted-foreground text-sm">
            Safety Assessment of Foreign Aircraft — denetim geçmişi ve oran takibi.
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
          <IconPlus className="size-4" />
          Yeni Denetim Ekle
        </Button>
      </div>

      {/* ── KPI kartları ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              {threshold === "high-risk" ? (
                <IconAlertTriangle className="size-3.5" />
              ) : (
                <IconShieldCheck className="size-3.5" />
              )}
              Güncel SAFA Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tabular-nums", THRESHOLD_CLASS[threshold])}>
              {ratio !== null ? ratio.toFixed(3) : "—"}
            </div>
            <Badge variant="outline" className={cn("mt-1.5", THRESHOLD_BADGE_CLASS[threshold])}>
              {SAFA_THRESHOLD_LABEL[threshold]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Toplam SAFA Denetim Sayısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{totals.count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Kategoriye Göre Bulgu Sayısı
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums">{totals.cat1}</div>
              <div className="text-muted-foreground text-[11px]">Cat 1</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {totals.cat2}
              </div>
              <div className="text-muted-foreground text-[11px]">Cat 2</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-red-700 dark:text-red-400">
                {totals.cat3}
              </div>
              <div className="text-muted-foreground text-[11px]">Cat 3</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              AB / Bölgesel Ortalama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {SAFA_EU_AVERAGE_REFERENCE.toFixed(2)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Referans kıyaslama değeri</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Trend grafiği ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SAFA Ratio Trend (kümülatif)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Grafik için henüz yeterli veri yok.
            </p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
              <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  fontSize={11}
                />
                <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} />
                <ReferenceLine
                  y={SAFA_EU_AVERAGE_REFERENCE}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{ value: "AB Ort.", fontSize: 10, position: "insideTopRight" }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="ratio"
                  type="monotone"
                  stroke="var(--color-ratio)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Filtreler ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`safa-from-${uid}`} className="text-muted-foreground text-xs">
            Tarih
          </Label>
          <Input
            id={`safa-from-${uid}`}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-36"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <Input
          value={registrationFilter}
          onChange={(e) => setRegistrationFilter(e.target.value)}
          placeholder="Uçak tescili ara…"
          className="h-9 max-w-[180px]"
        />
        <Input
          value={authorityFilter}
          onChange={(e) => setAuthorityFilter(e.target.value)}
          placeholder="Otorite ara…"
          className="h-9 max-w-[180px]"
        />
      </div>

      {/* ── Denetim geçmişi tablosu ── */}
      <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Tarih</TableHead>
              <TableHead>Yer / Havalimanı</TableHead>
              <TableHead>Otorite</TableHead>
              <TableHead>Tescil</TableHead>
              <TableHead className="text-center">Cat 1</TableHead>
              <TableHead className="text-center">Cat 2</TableHead>
              <TableHead className="text-center">Cat 3</TableHead>
              <TableHead className="text-center">Ağırlıklı Puan</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  Yükleniyor…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDateOnlyIstanbul(r.inspectionDate)}
                  </TableCell>
                  <TableCell className="text-sm">{r.location}</TableCell>
                  <TableCell className="text-sm">{r.authority}</TableCell>
                  <TableCell className="font-mono text-sm">{r.aircraftRegistration}</TableCell>
                  <TableCell className="text-center text-sm">{r.cat1Count}</TableCell>
                  <TableCell className="text-center text-sm text-amber-700 dark:text-amber-400">
                    {r.cat2Count}
                  </TableCell>
                  <TableCell className="text-center text-sm text-red-700 dark:text-red-400">
                    {r.cat3Count}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {safaWeightedFindings(r.cat1Count, r.cat2Count, r.cat3Count)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                        Düzenle
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive size-8"
                        onClick={() => setDeleteTarget(r)}
                        aria-label="Sil"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Yeni SAFA Denetimi" : "Denetimi Düzenle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`safa-date-${uid}`}>Denetim Tarihi</Label>
                <Input
                  id={`safa-date-${uid}`}
                  type="date"
                  value={form.inspectionDate}
                  onChange={(e) => setForm((f) => ({ ...f, inspectionDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`safa-reg-${uid}`}>Tescil / Uçak Bilgisi</Label>
                <Input
                  id={`safa-reg-${uid}`}
                  value={form.aircraftRegistration}
                  onChange={(e) => setForm((f) => ({ ...f, aircraftRegistration: e.target.value }))}
                  placeholder="ör. TC-ABC"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`safa-loc-${uid}`}>Denetim Yeri / Havalimanı (ICAO/IATA)</Label>
              <Input
                id={`safa-loc-${uid}`}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="ör. LTFM / IST — İstanbul Havalimanı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`safa-auth-${uid}`}>Denetleyen Otorite (CAA)</Label>
              <Input
                id={`safa-auth-${uid}`}
                value={form.authority}
                onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                placeholder="ör. DGCA Turkey, EASA, LBA…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`safa-c1-${uid}`}>Cat 1 (Minor)</Label>
                <Input
                  id={`safa-c1-${uid}`}
                  type="number"
                  min={0}
                  value={form.cat1Count}
                  onChange={(e) => setForm((f) => ({ ...f, cat1Count: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`safa-c2-${uid}`}>Cat 2 (Significant)</Label>
                <Input
                  id={`safa-c2-${uid}`}
                  type="number"
                  min={0}
                  value={form.cat2Count}
                  onChange={(e) => setForm((f) => ({ ...f, cat2Count: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`safa-c3-${uid}`}>Cat 3 (Major)</Label>
                <Input
                  id={`safa-c3-${uid}`}
                  type="number"
                  min={0}
                  value={form.cat3Count}
                  onChange={(e) => setForm((f) => ({ ...f, cat3Count: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`safa-notes-${uid}`}>Not (isteğe bağlı)</Label>
              <Input
                id={`safa-notes-${uid}`}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void submitForm()} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetim kaydı silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteTarget
              ? `${deleteTarget.aircraftRegistration} — ${formatDateOnlyIstanbul(deleteTarget.inspectionDate)} tarihli kayıt kalıcı olarak silinecek.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
