"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAlertTriangle,
  IconClipboardCheck,
  IconShieldCheck,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
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
  SACA_EU_AVERAGE_REFERENCE,
  SACA_THRESHOLD_LABEL,
  computeSacaRatio,
  sacaThreshold,
  sacaWeightedFindings,
  type SacaThreshold,
} from "@/lib/saca-ratio"
import type { SacaAuditRow } from "@/lib/saca-audits"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

const THRESHOLD_CLASS: Record<SacaThreshold, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  watch: "text-amber-700 dark:text-amber-400",
  "high-risk": "text-red-700 dark:text-red-400",
}

const THRESHOLD_BADGE_CLASS: Record<SacaThreshold, string> = {
  good: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  watch: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  "high-risk": "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  Planned: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  Initialized: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  Postponed: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  Completed: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
  Cancelled: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700",
}

const chartConfig = {
  ratio: {
    label: "SACA Ratio",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function SacaClient({ initialRows }: { initialRows: SacaAuditRow[] }) {
  const uid = React.useId()
  const [rows, setRows] = React.useState<SacaAuditRow[]>(initialRows)
  const [loading, setLoading] = React.useState(false)

  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [aircraftFilter, setAircraftFilter] = React.useState("")

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      if (aircraftFilter.trim()) params.set("aircraft", aircraftFilter.trim())
      const res = await fetch(`/api/saca-audits?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => [])) as SacaAuditRow[]
      if (res.ok && Array.isArray(data)) setRows(data)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, aircraftFilter])

  React.useEffect(() => {
    const t = window.setTimeout(() => void reload(), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, aircraftFilter])

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

  const ratio = computeSacaRatio(totals.cat1, totals.cat2, totals.cat3, totals.count)
  const threshold = sacaThreshold(ratio)

  const chartData = React.useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
    )
    let cumCat1 = 0
    let cumCat2 = 0
    let cumCat3 = 0
    return sorted.map((r, i) => {
      cumCat1 += r.cat1Count
      cumCat2 += r.cat2Count
      cumCat3 += r.cat3Count
      const cumRatio = computeSacaRatio(cumCat1, cumCat2, cumCat3, i + 1)
      return {
        date: formatDateOnlyIstanbul(r.plannedDate),
        ratio: cumRatio !== null ? Number(cumRatio.toFixed(3)) : 0,
      }
    })
  }, [rows])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <SetWorkspacePageTitle title="SACA Score" />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">SACA Score</h1>
        <p className="text-muted-foreground text-sm">
          Kendi uçaklarımıza yaptığımız SACA denetimleri — Denetim Planı&apos;ndaki SACA kategorisi
          kayıtlarından ve bulgularından otomatik hesaplanır. Yeni denetim/bulgu eklemek için{" "}
          <Link href="/compliance/audit-plan" className="text-foreground underline underline-offset-2 hover:no-underline">
            Denetim Planı
          </Link>
          &apos;nı kullanın.
        </p>
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
              Güncel SACA Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tabular-nums", THRESHOLD_CLASS[threshold])}>
              {ratio !== null ? ratio.toFixed(3) : "—"}
            </div>
            <Badge variant="outline" className={cn("mt-1.5", THRESHOLD_BADGE_CLASS[threshold])}>
              {SACA_THRESHOLD_LABEL[threshold]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <IconClipboardCheck className="size-3.5" />
              Toplam SACA Denetim Sayısı
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
              {SACA_EU_AVERAGE_REFERENCE.toFixed(2)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Referans kıyaslama değeri</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Trend grafiği ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SACA Ratio Trend (kümülatif)</CardTitle>
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
                  y={SACA_EU_AVERAGE_REFERENCE}
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
          <Label htmlFor={`saca-from-${uid}`} className="text-muted-foreground text-xs">
            Tarih
          </Label>
          <Input
            id={`saca-from-${uid}`}
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
          value={aircraftFilter}
          onChange={(e) => setAircraftFilter(e.target.value)}
          placeholder="Uçak tescili / alt kategori ara…"
          className="h-9 max-w-[220px]"
        />
      </div>

      {/* ── Denetim geçmişi tablosu ── */}
      <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Tarih</TableHead>
              <TableHead>Denetim No</TableHead>
              <TableHead>Tescil / Alt Kategori</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-center">Cat 1</TableHead>
              <TableHead className="text-center">Cat 2</TableHead>
              <TableHead className="text-center">Cat 3</TableHead>
              <TableHead className="text-center">Ağırlıklı Puan</TableHead>
              <TableHead className="text-right">Denetim</TableHead>
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
                  SACA kategorisinde denetim kaydı bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              [...rows]
                .sort((a, b) => new Date(b.plannedDate).getTime() - new Date(a.plannedDate).getTime())
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateOnlyIstanbul(r.plannedDate)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.auditNumber}</TableCell>
                    <TableCell className="text-sm">{r.aircraft}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap",
                          STATUS_BADGE_CLASS[r.status] ??
                            "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300"
                        )}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.cat1Count}</TableCell>
                    <TableCell className="text-center text-sm text-amber-700 dark:text-amber-400">
                      {r.cat2Count}
                    </TableCell>
                    <TableCell className="text-center text-sm text-red-700 dark:text-red-400">
                      {r.cat3Count}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {sacaWeightedFindings(r.cat1Count, r.cat2Count, r.cat3Count)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/compliance/audit-plan/${r.id}/session`}
                        className="text-primary text-sm underline-offset-2 hover:underline"
                      >
                        Denetimi Aç
                      </Link>
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
