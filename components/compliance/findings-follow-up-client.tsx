"use client"

import * as React from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/context"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderOpen,
  HelpCircle,
  Lightbulb,
  MoreVertical,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { findingCategoryLabels, findingCategoryStyles } from "@/lib/finding-category"
import { cn } from "@/lib/utils"

type FindingRow = {
  id: number
  findingCode: string
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde dolu, diğerlerinde null. */
  findingCategory: string | null
  auditNumber: string | null
  initializedOn: string
  field: string | null
  explanation: string
  reference: string | null
  dueDate: string | null
  status: string
  /** Person/Group karşılıklı dışlayıcı — ikisi birden dolu olamaz. */
  assignedTo: { id: number; name: string } | null
  assignedGroup: { id: number; name: string } | null
  cpaRequests: string
  /** cpaRequests'in ekranda gösterilen "toplam/kabul/red" metnini oluşturan ham sayılar — sıralama bunları kullanır. */
  totalCpa: number
  acceptedCpa: number
  rejectedCpa: number
  pendingCpa: number
  hasExtension: boolean
  extExpired: boolean
  isOverdue: boolean
  noCpa: boolean
}

type FollowUpSortColumn =
  | "findingCode"
  | "category"
  | "auditNumber"
  | "initializedOn"
  | "field"
  | "responsible"
  | "dueDate"
  | "cpaRequests"
/** Sıralama anahtarı: tarih kolonları gerçek Date değeri, CPA Requests ham sayısal
 * tuple (composite metin değil), diğerleri Türkçe-duyarlı metin. */
function followUpSortKey(row: FindingRow, column: FollowUpSortColumn): string | number | null {
  switch (column) {
    case "findingCode":
      return row.findingCode?.trim() || null
    case "category":
      return row.findingCategory?.trim() || null
    case "auditNumber":
      return row.auditNumber?.trim() || null
    case "initializedOn": {
      const t = new Date(row.initializedOn).getTime()
      return Number.isFinite(t) ? t : null
    }
    case "field":
      return row.field?.trim() || null
    case "responsible":
      // Gruba atanmışsa grup adı, kişiye atanmışsa kişi adı — aynı sıralama mantığına dahil.
      return row.assignedGroup?.name?.trim() || row.assignedTo?.name?.trim() || null
    case "dueDate": {
      if (!row.dueDate) return null
      const t = new Date(row.dueDate).getTime()
      return Number.isFinite(t) ? t : null
    }
    case "cpaRequests":
      // Ekrandaki "3/1/0" composite metnini değil, altındaki ham sayıları kullan:
      // önce toplam istek, eşitlikte kabul, eşitlikte red — tek sayısal anahtarda birleştirilir.
      return row.totalCpa * 1_000_000 + row.acceptedCpa * 1_000 + row.rejectedCpa
    default:
      return null
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch { return "—" }
}

export function FindingsFollowUpClient() {
  const { t } = useLanguage()
  const [rows, setRows] = React.useState<FindingRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showClosed, setShowClosed] = React.useState(true)
  const [fieldFilter, setFieldFilter] = React.useState("All")
  const [categoryFilter, setCategoryFilter] = React.useState("All")
  const [sortColumn, setSortColumn] = React.useState<FollowUpSortColumn | null>(null)
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")

  const toggleSort = (column: FollowUpSortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"))
        return prevCol
      }
      setSortDir("asc")
      return column
    })
  }

  const renderSortIcon = (column: FollowUpSortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="size-3.5 opacity-50" />
    return sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/audit-findings", { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok || !Array.isArray(data)) { toast.error("Yüklenemedi."); return }
      setRows(data as FindingRow[])
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  // Summary stats
  const stats = React.useMemo(() => {
    const opens = rows.filter((r) => r.status === "Open").length
    const closes = rows.filter((r) => r.status === "Closed").length
    const overdue = rows.filter((r) => r.isOverdue).length
    const extensions = rows.filter((r) => r.hasExtension).length
    const extOverdue = rows.filter((r) => r.extExpired).length
    const noCpa = rows.filter((r) => r.noCpa).length
    return { opens, closes, overdue, extensions, extOverdue, noCpa }
  }, [rows])

  // Unique fields for filter
  const fields = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.field ?? "").filter(Boolean))
    return ["All", ...Array.from(set).sort()]
  }, [rows])

  // Bulunan Finding Category değerleri (yalnızca SACA/SAFA bulgularında dolu)
  const categories = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.findingCategory ?? "").filter(Boolean))
    return ["All", ...Array.from(set).sort()]
  }, [rows])

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (!showClosed && r.status === "Closed") return false
      if (fieldFilter !== "All" && r.field !== fieldFilter) return false
      if (categoryFilter !== "All" && r.findingCategory !== categoryFilter) return false
      return true
    })
  }, [rows, showClosed, fieldFilter, categoryFilter])

  // Filtrelenmiş sonuç üzerinde client-side sıralama — yeni API/N+1 yok, halihazırda
  // yüklü satırlar kullanılır. Filtre değişince `filtered` yeniden hesaplanır, sort
  // state'i (sortColumn/sortDir) korunur — aktif sıralama bozulmaz.
  const sorted = React.useMemo(() => {
    if (!sortColumn) return filtered
    const withKey = filtered.map((row) => ({ row, key: followUpSortKey(row, sortColumn) }))
    withKey.sort((a, b) => {
      // Boş/ayrıştırılamayan değerler sıralama yönünden bağımsız olarak sona atılır.
      if (a.key === null && b.key === null) return 0
      if (a.key === null) return 1
      if (b.key === null) return -1
      // Sayısal anahtarlar (tarihler, CPA Requests) doğrudan; metin anahtarlar
      // Türkçe-duyarlı + sayı-duyarlı (ör. "FUP-2" "FUP-10"'dan önce gelir).
      const cmp =
        typeof a.key === "number" && typeof b.key === "number"
          ? a.key - b.key
          : String(a.key).localeCompare(String(b.key), "tr", { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
    return withKey.map((x) => x.row)
  }, [filtered, sortColumn, sortDir])

  const summaryCards = [
    {
      label: "Opens",
      value: stats.opens,
      sub: "Open items",
      icon: <FolderOpen className="size-5 text-blue-500" />,
      border: "border-l-blue-500",
    },
    {
      label: "Closes",
      value: stats.closes,
      sub: "Closed items",
      icon: <CheckCircle2 className="size-5 text-green-500" />,
      border: "border-l-green-500",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      sub: "Past due date",
      icon: <AlertTriangle className="size-5 text-red-500" />,
      border: "border-l-red-500",
    },
    {
      label: "Extensions",
      value: stats.extensions,
      sub: "With extension",
      icon: <CalendarClock className="size-5 text-violet-500" />,
      border: "border-l-violet-500",
    },
    {
      label: "Ext. Overdue",
      value: stats.extOverdue,
      sub: "Extension expired",
      icon: <Clock className="size-5 text-orange-500" />,
      border: "border-l-orange-500",
    },
    {
      label: "No CPA",
      value: stats.noCpa,
      sub: "Without CPA",
      icon: <Lightbulb className="size-5 text-yellow-500" />,
      border: "border-l-yellow-500",
    },
  ]

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={t.nav.findingsFollowUp} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Findings Follow Up</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
            <Link href="/compliance"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="size-5 text-blue-600" />
            Follow Up
          </h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md">
                <HelpCircle className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs" side="bottom">
              Denetimlerde Unsatisfactory işaretlenen maddeler buraya bulgu olarak eklenir. Her bulguda kök neden analizi yapılır.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "bg-card rounded-lg border border-l-4 p-3 shadow-sm",
                card.border
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-muted-foreground text-xs">{card.sub}</p>
                </div>
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-closed"
              checked={showClosed}
              onCheckedChange={(v) => setShowClosed(v === true)}
            />
            <label htmlFor="show-closed" className="text-sm cursor-pointer select-none">
              Show Closed
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 1 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue placeholder="Finding Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "All" ? "All Categories" : findingCategoryLabels[c as keyof typeof findingCategoryLabels] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm">
          <ScrollArea className="h-[min(65vh,700px)]">
            {/* containerClassName: Table'ın kendi overflow-x-auto sarmalayıcısı BİLEREK
                verilmiyor — ScrollArea'nın Viewport'u zaten hem x hem y scroll'u tek
                elemanda yönetiyor; ayrı bir iç overflow-x-auto div sticky header'ı kırar
                (bkz. components/ui/table.tsx Table containerClassName açıklaması). */}
            <Table containerClassName="relative w-full">
              <TableHeader sticky>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-12 px-2" />
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("findingCode")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Follow UP Code
                      {renderSortIcon("findingCode")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("category")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Category
                      {renderSortIcon("category")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("auditNumber")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Audit Number
                      {renderSortIcon("auditNumber")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("initializedOn")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Initialized On
                      {renderSortIcon("initializedOn")}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("field")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Field
                      {renderSortIcon("field")}
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">Explanation</TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("responsible")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Responsible
                      {renderSortIcon("responsible")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("dueDate")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Due Date
                      {renderSortIcon("dueDate")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort("cpaRequests")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      CPA Requests
                      {renderSortIcon("cpaRequests")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground h-32 text-center">
                      Yükleniyor…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground h-32 text-center">
                      {rows.length === 0 ? "Henüz bulgu yok." : "Filtre ile eşleşen kayıt yok."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "group",
                        row.status === "Closed" && "opacity-60",
                        row.isOverdue && row.status === "Open" && "bg-red-50/40 dark:bg-red-950/10"
                      )}
                    >
                      <TableCell className="w-12 px-1 align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              aria-label="İşlemler"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem asChild>
                              <Link href={`/compliance/findings-follow-up/${row.id}`}>
                                Detay & Cevap Ver
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        <Link
                          href={`/compliance/findings-follow-up/${row.id}`}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {row.findingCode}
                        </Link>
                        {row.isOverdue && row.status === "Open" && (
                          <AlertTriangle className="inline ml-1 size-3.5 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.findingCategory ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              findingCategoryStyles[row.findingCategory as keyof typeof findingCategoryStyles]
                            )}
                          >
                            {findingCategoryLabels[row.findingCategory as keyof typeof findingCategoryLabels] ?? row.findingCategory}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.auditNumber ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(row.initializedOn)}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm" title={row.field ?? ""}>
                        {row.field ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[240px] text-sm">
                        <span className="line-clamp-2">{row.explanation}</span>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {row.assignedGroup ? (
                          <span className="flex items-center gap-1 text-muted-foreground" title={row.assignedGroup.name}>
                            <Users className="size-3 shrink-0" />
                            {row.assignedGroup.name}
                          </span>
                        ) : row.assignedTo ? (
                          <span className="text-muted-foreground" title={row.assignedTo.name}>{row.assignedTo.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        "whitespace-nowrap text-sm",
                        row.isOverdue && row.status === "Open" ? "text-red-600 font-medium" : ""
                      )}>
                        {formatDate(row.dueDate)}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        <div className="flex items-center gap-1">
                          {row.cpaRequests}
                          {row.noCpa && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs px-1">
                              No CPA
                            </Badge>
                          )}
                          {row.hasExtension && (
                            <Badge variant="outline" className={cn(
                              "text-xs px-1",
                              row.extExpired
                                ? "text-orange-600 border-orange-300"
                                : "text-violet-600 border-violet-300"
                            )}>
                              Ext
                            </Badge>
                          )}
                        </div>
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
    </TooltipProvider>
  )
}
