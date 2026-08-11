"use client"

import { useRef, useState } from "react"
import ExcelJS from "exceljs"
import { toPng } from "html-to-image"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { PerformanceReportsData } from "@/app/api/performance-reports/route"
import { useLanguage } from "@/lib/i18n/context"

// ─── Palette ──────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  internal: "#3b82f6",
  external: "#f59e0b",
  saca: "#8b5cf6",
  safa: "#06b6d4",
  other: "#6b7280",
}

const CHART_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4",
  "#ef4444", "#f97316", "#ec4899", "#84cc16", "#14b8a6",
]

const STATUS_COLORS = {
  timelyClosed: "#22c55e",
  closedLate: "#f97316",
  closedNoDl: "#94a3b8",
  overdue: "#ef4444",
  openOnTrack: "#3b82f6",
}

// STATUS_LABELS is now built dynamically inside the component using i18n

// ─── Helper components ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "bg-card",
  textColor = "text-foreground",
}: {
  label: string
  value: number | string
  sub?: string
  color?: string
  textColor?: string
}) {
  return (
    <div className={`${color} rounded-xl border p-4 flex flex-col gap-1 shadow-sm`}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mt-2">
      <span className="block w-1 h-4 rounded bg-primary" />
      {children}
    </h2>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill }} className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ background: p.fill }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { percent?: number } }[]
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{p.name}</p>
      <p className="text-muted-foreground">{p.value}</p>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function PerformanceReportsClient({ data }: { data: PerformanceReportsData }) {
  const { t } = useLanguage()
  const pr = t.perfReports

  const STATUS_LABELS = {
    timelyClosed: pr.timelyClosed,
    closedLate: pr.closedLate,
    closedNoDl: pr.closedNoDl,
    overdue: pr.overdue,
    openOnTrack: pr.openOnTrack,
  }

  const { years, auditStats, findingStats, hazardStats } = data
  const [selectedYear, setSelectedYear] = useState<number>(years[years.length - 1])
  const [exporting, setExporting] = useState(false)

  const auditY = auditStats.find((s) => s.year === selectedYear)!
  const findingY = findingStats.find((s) => s.year === selectedYear)!
  const hazardY = hazardStats.find((s) => s.year === selectedYear)!

  // Excel export'a gömülecek grafiklerin canlı DOM referansları — ekranda görünenin
  // birebir (aynı veri kaynağı, aynı seçili yıl) yüksek çözünürlüklü görüntüsü alınır.
  const catPieCardRef = useRef<HTMLDivElement>(null)
  const auditBarCardRef = useRef<HTMLDivElement>(null)
  const findingPieCardRef = useRef<HTMLDivElement>(null)
  const deptBarCardRef = useRef<HTMLDivElement>(null)
  const hazardYearBarCardRef = useRef<HTMLDivElement>(null)
  const hazardSourcePieCardRef = useRef<HTMLDivElement>(null)
  const hazardDeptBarCardRef = useRef<HTMLDivElement>(null)

  /** Bir grafik kartını yüksek çözünürlüklü PNG'ye çevirir. Veri yoksa (EmptyState) bile
   *  görüneni yakalar; herhangi bir hata durumunda export'u kesmeden null döner. */
  async function captureChartCard(
    ref: React.RefObject<HTMLDivElement | null>
  ): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const node = ref.current
    if (!node) return null
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      })
      return { dataUrl, width: node.offsetWidth, height: node.offsetHeight }
    } catch {
      return null
    }
  }

  const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1A365D" } }
  const TITLE_FONT = { bold: true, size: 13, color: { argb: "FF1A365D" } }
  const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } }

  /** Sütun sayısını açıkça alır — satırın .values atamasından önce veya sonra
   *  çağrılmasından bağımsız olarak, her zaman doğru hücreleri stiller. */
  function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      cell.fill = HEADER_FILL
      cell.font = HEADER_FONT
      cell.alignment = { vertical: "middle" }
    }
  }

  /** Bir görsel yakalamayı worksheet'e ekler; görsel alınamadıysa (veri yok/hata)
   *  export'u bozmadan bilgilendirici bir not satırı bırakır. */
  function embedChartImage(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    captured: { dataUrl: string; width: number; height: number } | null,
    title: string,
    row: number
  ): number {
    ws.getCell(row, 1).value = title
    ws.getCell(row, 1).font = { bold: true, size: 11 }
    if (!captured) {
      ws.getCell(row + 1, 1).value = "Bu grafik için veri bulunmuyor."
      ws.getCell(row + 1, 1).font = { italic: true, color: { argb: "FF888888" } }
      return row + 3
    }
    const imageId = wb.addImage({ base64: captured.dataUrl, extension: "png" })
    // Ekrandaki css-piksel boyutunu koru (pixelRatio yalnızca çözünürlüğü artırır).
    // ExcelJS resim çapaları 0-index'lidir (getCell/getRow ise 1-index'li); "row" (1-index)
    // başlık satırıdır — resmi başlığın hemen altındaki satırın üst kenarına hizalar.
    const maxWidth = 640
    const scale = Math.min(1, maxWidth / captured.width)
    ws.addImage(imageId, {
      tl: { col: 0, row },
      ext: { width: captured.width * scale, height: captured.height * scale },
    })
    const rowsUsed = Math.ceil((captured.height * scale) / 20) + 2
    return row + 1 + rowsUsed
  }

  async function handleExportExcel() {
    setExporting(true)
    try {
      // Ekranda görünen grafiklerin anlık (seçili yıla göre) görüntülerini paralel yakala
      const [
        catPie,
        auditBar,
        findingPie,
        deptBar,
        hazardYearBar,
        hazardSourcePie,
        hazardDeptBar,
      ] = await Promise.all([
        captureChartCard(catPieCardRef),
        captureChartCard(auditBarCardRef),
        captureChartCard(findingPieCardRef),
        captureChartCard(deptBarCardRef),
        captureChartCard(hazardYearBarCardRef),
        captureChartCard(hazardSourcePieCardRef),
        captureChartCard(hazardDeptBarCardRef),
      ])

      const wb = new ExcelJS.Workbook()
      wb.creator = "Bon Air — Compliance Monitoring"
      wb.created = new Date()

      // ── Sheet 1: Audit Summary ──────────────────────────────────────────
      const wsAudit = wb.addWorksheet("Audit Summary")
      wsAudit.columns = [
        { width: 10 }, { width: 16 }, { width: 16 }, { width: 16 },
        { width: 10 }, { width: 10 }, { width: 30 },
      ]
      wsAudit.getCell(1, 1).value = `Audit Summary — ${selectedYear}`
      wsAudit.getCell(1, 1).font = TITLE_FONT
      wsAudit.getRow(3).values = [
        "Year", "Total Audits", "Internal Audits", "External Audits", "SACA", "SAFA",
        "Incoming Audits (External+SACA+SAFA)",
      ]
      styleHeaderRow(wsAudit.getRow(3), 7)
      let r = 4
      for (const s of auditStats) {
        wsAudit.getRow(r).values = [s.year, s.total, s.internal, s.external, s.saca, s.safa, s.incoming]
        r++
      }
      r += 1
      wsAudit.getCell(r, 1).value = `${selectedYear} — Category Distribution`
      wsAudit.getCell(r, 1).font = { bold: true, size: 11 }
      r += 1
      styleHeaderRow(wsAudit.getRow(r), 2)
      wsAudit.getRow(r).values = ["Category", "Count"]
      r += 1
      if (auditY.byCategory.length === 0) {
        wsAudit.getCell(r, 1).value = "Bu yıl için denetim verisi bulunmuyor."
        wsAudit.getCell(r, 1).font = { italic: true, color: { argb: "FF888888" } }
        r += 1
      } else {
        for (const c of auditY.byCategory) {
          wsAudit.getRow(r).values = [c.name, c.count]
          r++
        }
      }
      r += 2
      r = embedChartImage(wb, wsAudit, catPie, `${selectedYear} — Yıllık Kategori Dağılımı`, r)
      r = embedChartImage(wb, wsAudit, auditBar, "3 Yıllık Denetim Karşılaştırması", r)

      // ── Sheet 2: Findings ────────────────────────────────────────────────
      const wsFindings = wb.addWorksheet("Findings")
      wsFindings.columns = [{ width: 28 }, { width: 16 }]
      wsFindings.getCell(1, 1).value = `Findings — ${selectedYear}`
      wsFindings.getCell(1, 1).font = TITLE_FONT
      let fr = 3
      styleHeaderRow(wsFindings.getRow(fr), 2)
      wsFindings.getRow(fr).values = ["Metric", "Value"]
      fr++
      const findingMetrics: [string, number][] = [
        ["Total Findings", findingY.total],
        ["Timely Closed", findingY.timelyClosed],
        ["Closed Late", findingY.closedLate],
        ["Closed (No Due Date)", findingY.closedNoDl],
        ["Overdue (Open)", findingY.overdue],
        ["Open (On Track)", findingY.openOnTrack],
        ["With Extension", findingY.withExtension],
      ]
      for (const [k, v] of findingMetrics) {
        wsFindings.getRow(fr).values = [k, v]
        fr++
      }
      fr += 1
      wsFindings.getCell(fr, 1).value = `${selectedYear} — Findings by Department`
      wsFindings.getCell(fr, 1).font = { bold: true, size: 11 }
      fr += 1
      styleHeaderRow(wsFindings.getRow(fr), 5)
      wsFindings.getRow(fr).values = ["Department", "Total", "Timely Closed", "Overdue (Open)", "With Extension"]
      wsFindings.getColumn(3).width = 16
      wsFindings.getColumn(4).width = 16
      wsFindings.getColumn(5).width = 16
      fr++
      if (findingY.byDepartment.length === 0) {
        wsFindings.getCell(fr, 1).value = "Bu yıl için bulgu verisi bulunmuyor."
        wsFindings.getCell(fr, 1).font = { italic: true, color: { argb: "FF888888" } }
        fr += 1
      } else {
        for (const d of findingY.byDepartment) {
          wsFindings.getRow(fr).values = [d.departman, d.total, d.timelyClosed, d.overdue, d.withExtension]
          fr++
        }
      }
      fr += 2
      fr = embedChartImage(wb, wsFindings, findingPie, `${selectedYear} — Bulgu Kapanış Durumu`, fr)
      fr = embedChartImage(wb, wsFindings, deptBar, `${selectedYear} — Departmana Göre Bulgular`, fr)

      // ── Sheet 3: Hazard Reports ──────────────────────────────────────────
      const wsHazards = wb.addWorksheet("Hazard Reports")
      wsHazards.columns = [{ width: 26 }, { width: 16 }]
      wsHazards.getCell(1, 1).value = `Hazard Reports — ${selectedYear}`
      wsHazards.getCell(1, 1).font = TITLE_FONT
      let hr = 3
      styleHeaderRow(wsHazards.getRow(hr), 2)
      wsHazards.getRow(hr).values = ["Year", "Total Hazard Reports"]
      hr++
      for (const s of hazardStats) {
        wsHazards.getRow(hr).values = [s.year, s.total]
        hr++
      }
      hr += 1
      wsHazards.getCell(hr, 1).value = `${selectedYear} — By Source`
      wsHazards.getCell(hr, 1).font = { bold: true, size: 11 }
      hr += 1
      styleHeaderRow(wsHazards.getRow(hr), 2)
      wsHazards.getRow(hr).values = ["Source", "Count"]
      hr++
      if (hazardY.bySource.length === 0) {
        wsHazards.getCell(hr, 1).value = "Bu yıl için veri bulunmuyor."
        wsHazards.getCell(hr, 1).font = { italic: true, color: { argb: "FF888888" } }
        hr += 1
      } else {
        for (const s of hazardY.bySource) {
          wsHazards.getRow(hr).values = [s.source, s.count]
          hr++
        }
      }
      hr += 1
      wsHazards.getCell(hr, 1).value = `${selectedYear} — By Department`
      wsHazards.getCell(hr, 1).font = { bold: true, size: 11 }
      hr += 1
      styleHeaderRow(wsHazards.getRow(hr), 2)
      wsHazards.getRow(hr).values = ["Department", "Count"]
      hr++
      if (hazardY.byDepartment.length === 0) {
        wsHazards.getCell(hr, 1).value = "Bu yıl için veri bulunmuyor."
        wsHazards.getCell(hr, 1).font = { italic: true, color: { argb: "FF888888" } }
        hr += 1
      } else {
        for (const d of hazardY.byDepartment) {
          wsHazards.getRow(hr).values = [d.departman, d.count]
          hr++
        }
      }
      hr += 2
      hr = embedChartImage(wb, wsHazards, hazardYearBar, "3 Yıllık Hazard Report Karşılaştırması", hr)
      hr = embedChartImage(wb, wsHazards, hazardSourcePie, `${selectedYear} — Kaynak Dağılımı`, hr)
      hr = embedChartImage(wb, wsHazards, hazardDeptBar, `${selectedYear} — Departmana Göre Hazard`, hr)

      // ── Sheet 4: Department Analysis (mevcut mantık aynen korunur) ───────
      const wsDept = wb.addWorksheet("Department Analysis")
      wsDept.columns = [
        { width: 10 }, { width: 26 }, { width: 16 }, { width: 20 },
        { width: 20 }, { width: 18 }, { width: 16 },
      ]
      styleHeaderRow(wsDept.getRow(1), 7)
      wsDept.getRow(1).values = [
        "Year", "Department", "Findings (Total)", "Findings (Timely Closed)",
        "Findings (Overdue Open)", "Findings (With Extension)", "Hazard Reports",
      ]
      const hazardDept = new Map(hazardY.byDepartment.map((d) => [d.departman, d.count] as const))
      const allDepts = new Set<string>([
        ...findingY.byDepartment.map((d) => d.departman),
        ...hazardY.byDepartment.map((d) => d.departman),
      ])
      let dr = 2
      for (const dept of Array.from(allDepts).sort((a, b) => a.localeCompare(b, "tr"))) {
        const f = findingY.byDepartment.find((x) => x.departman === dept)
        wsDept.getRow(dr).values = [
          selectedYear, dept, f?.total ?? 0, f?.timelyClosed ?? 0, f?.overdue ?? 0,
          f?.withExtension ?? 0, hazardDept.get(dept) ?? 0,
        ]
        dr++
      }

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `performance-reports-${selectedYear}.xlsx`
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── 3-year stacked bar data for audits ──
  const allCategoryNames = Array.from(
    new Set(auditStats.flatMap((s) => s.byCategory.map((c) => c.name)))
  )
  const auditBarData = auditStats.map((s) => {
    const row: Record<string, string | number> = { year: String(s.year) }
    for (const name of allCategoryNames) {
      row[name] = s.byCategory.find((c) => c.name === name)?.count ?? 0
    }
    return row
  })

  // ── Findings closure pie data ──
  const findingPieData = [
    { name: STATUS_LABELS.timelyClosed, value: findingY.timelyClosed, color: STATUS_COLORS.timelyClosed },
    { name: STATUS_LABELS.closedLate, value: findingY.closedLate, color: STATUS_COLORS.closedLate },
    { name: STATUS_LABELS.closedNoDl, value: findingY.closedNoDl, color: STATUS_COLORS.closedNoDl },
    { name: STATUS_LABELS.overdue, value: findingY.overdue, color: STATUS_COLORS.overdue },
    { name: STATUS_LABELS.openOnTrack, value: findingY.openOnTrack, color: STATUS_COLORS.openOnTrack },
  ].filter((d) => d.value > 0)

  // ── Hazard 3-year bar ──
  const hazardBarData = hazardStats.map((s) => ({ year: String(s.year), total: s.total }))

  // ── Category color helper ──
  function getCatColor(name: string, idx: number): string {
    const n = name.toLowerCase()
    if (n.includes("saca")) return CAT_COLORS.saca
    if (n.includes("safa")) return CAT_COLORS.safa
    if (n.includes("iç") || n.includes("internal")) return CAT_COLORS.internal
    if (n.includes("dış") || n.includes("external")) return CAT_COLORS.external
    return CHART_COLORS[idx % CHART_COLORS.length]
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-4">

      {/* ── Year tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1 w-fit">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                selectedYear === y
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleExportExcel()}
          disabled={exporting}
          className="h-9 rounded-md border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? "Hazırlanıyor…" : pr.exportExcel}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BÖLÜM 1: DENETİM İSTATİSTİKLERİ                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <SectionTitle>{pr.auditStats} — {selectedYear}</SectionTitle>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label={pr.totalAudit} value={auditY.total} />
          <StatCard label={pr.internal} value={auditY.internal} textColor="text-blue-600" />
          <StatCard label={pr.external} value={auditY.external} textColor="text-amber-500" />
          <StatCard label="SACA" value={auditY.saca} textColor="text-purple-600" />
          <StatCard label="SAFA" value={auditY.safa} textColor="text-cyan-600" />
          <StatCard label={pr.incoming} value={auditY.incoming} sub={pr.incomingSub} textColor="text-rose-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie: this year by category */}
          <div ref={catPieCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.categoryDist}</p>
            {auditY.byCategory.length === 0 ? (
              <EmptyState message={`${selectedYear} ${pr.noAuditData}`} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={auditY.byCategory}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name.slice(0, 16)} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {auditY.byCategory.map((entry, i) => (
                      <Cell key={entry.name} fill={getCatColor(entry.name, i)} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Stacked bar: 3 years comparison */}
          <div ref={auditBarCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{pr.threeYearComparison}</p>
            {auditBarData.every((r) => allCategoryNames.every((n) => r[n] === 0)) ? (
              <EmptyState message={pr.noThreeYearData} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={auditBarData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  {allCategoryNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={getCatColor(name, i)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BÖLÜM 2: BULGU ANALİZİ                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <SectionTitle>{pr.findingAnalysis} — {selectedYear}</SectionTitle>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label={pr.totalFinding} value={findingY.total} />
          <StatCard label={pr.timelyClosed} value={findingY.timelyClosed} textColor="text-green-600" />
          <StatCard label={pr.extensionRequested} value={findingY.withExtension} textColor="text-yellow-600" />
          <StatCard label={pr.overdue} value={findingY.overdue} textColor="text-red-600" />
          <StatCard label={pr.closedLate} value={findingY.closedLate} textColor="text-orange-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie: closure status */}
          <div ref={findingPieCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.findingClosureStatus}</p>
            {findingPieData.length === 0 ? (
              <EmptyState message={`${selectedYear} ${pr.noFindingData}`} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={findingPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ name, percent }) =>
                      `${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {findingPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(v) => <span className="text-xs">{v}</span>}
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Horizontal bar: findings by department */}
          <div ref={deptBarCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.findingsByDept}</p>
            {findingY.byDepartment.length === 0 ? (
              <EmptyState message={`${selectedYear} ${pr.noDeptData}`} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, findingY.byDepartment.length * 40)}>
                <BarChart
                  data={findingY.byDepartment}
                  layout="vertical"
                  barCategoryGap="20%"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="departman"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Bar dataKey="total" name={pr.barTotal} fill="#3b82f6" stackId="d" />
                  <Bar dataKey="timelyClosed" name={pr.barTimely} fill="#22c55e" stackId="d" />
                  <Bar dataKey="overdue" name={pr.barOverdue} fill="#ef4444" stackId="d" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Extension detail table */}
        {findingY.byDepartment.some((d) => d.withExtension > 0) && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.extensionDepts}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{pr.colDept}</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">{pr.colTotalFinding}</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">{pr.colExtension}</th>
                  </tr>
                </thead>
                <tbody>
                  {findingY.byDepartment
                    .filter((d) => d.withExtension > 0)
                    .map((d) => (
                      <tr key={d.departman} className="border-b last:border-0">
                        <td className="py-2 pr-4">{d.departman}</td>
                        <td className="py-2 pr-4 text-right">{d.total}</td>
                        <td className="py-2 text-right text-yellow-700 font-medium">{d.withExtension}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BÖLÜM 3: HAZARD REPORTS                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4 pb-6">
        <SectionTitle>{pr.hazardSection} — {selectedYear}</SectionTitle>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={pr.totalHazard} value={hazardY.total} />
          <StatCard label={pr.sourceCount} value={hazardY.bySource.length} sub={pr.differentSource} />
          <StatCard label={pr.deptCount} value={hazardY.byDepartment.length} sub={pr.reporting} />
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{pr.threeYearTotal}</p>
            <p className="text-3xl font-bold mt-1">
              {hazardStats.reduce((s, y) => s + y.total, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {years[0]}–{years[years.length - 1]}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar: 3-year totals */}
          <div ref={hazardYearBarCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{pr.hazardByYear}</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hazardBarData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Hazard" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: by source type — dilim etiketleri kapalı; özet grid ile okunabilir */}
          <div ref={hazardSourcePieCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.sourceDistribution}</p>
            {hazardY.bySource.length === 0 ? (
              <EmptyState message={`${selectedYear} ${pr.noHazardData}`} />
            ) : (
              <div className="flex flex-col gap-3">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={hazardY.bySource}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={82}
                      innerRadius={0}
                      paddingAngle={1}
                      label={false}
                    >
                      {hazardY.bySource.map((entry, i) => (
                        <Cell key={entry.source} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(() => {
                    const srcTotal = hazardY.bySource.reduce((s, x) => s + x.count, 0)
                    return hazardY.bySource.map((row, i) => {
                      const pct =
                        srcTotal > 0 ? ((row.count / srcTotal) * 100).toFixed(1) : "0"
                      return (
                        <li
                          key={row.source}
                          className="flex gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-2 text-xs"
                        >
                          <span
                            className="mt-0.5 size-2.5 shrink-0 rounded-sm ring-1 ring-border/50"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 leading-snug">
                            <span className="block break-words font-medium text-foreground">
                              {row.source}
                            </span>
                            <span className="text-muted-foreground">
                              {row.count} {pr.count} · %{pct}
                            </span>
                          </span>
                        </li>
                      )
                    })
                  })()}
                </ul>
              </div>
            )}
          </div>

          {/* Bar: by department (horizontal) */}
          <div ref={hazardDeptBarCardRef} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">{selectedYear} — {pr.hazardByDept}</p>
            {hazardY.byDepartment.length === 0 ? (
              <EmptyState message={`${selectedYear} ${pr.noDeptData}`} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, hazardY.byDepartment.length * 36)}>
                <BarChart
                  data={hazardY.byDepartment}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="departman"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Hazard" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
