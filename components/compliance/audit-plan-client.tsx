"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/context"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  List,
  Loader2,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AuditCategoryCombobox } from "@/components/compliance/audit-category-combobox"
import { PostponeAuditDialog } from "@/components/compliance/postpone-audit-dialog"
import { EmployeeCombobox } from "@/components/employee-combobox"
import type { AuditChecklistListRow } from "@/components/compliance/audit-checklists-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { parseDdMmYyyyToUtcDate, todayLocalDdMmYyyy } from "@/lib/correspondence-date"
import { uploadAuditPlanDocumentsDirect } from "@/lib/client-audit-plan-document-upload"
import {
  downloadFullReportPdf,
  downloadInitialReportPdf,
  type AuditPlanReportData,
} from "@/lib/audit-plan-report-download"
import {
  FINDING_CATEGORY_VALUES,
  findingCategoryLabels,
  findingCategoryStyles,
  isSacaOrSafaAuditCategory,
} from "@/lib/finding-category"
import { cn } from "@/lib/utils"

type CalisanLite = { id: number; isim: string | null; soyisim: string | null }

/** Referans ekrandaki durum rozetleri */
export const statusStyles: Record<string, string> = {
  Planned:     "bg-blue-500 text-white",
  Initialized: "bg-emerald-600 text-white",
  Postponed:   "bg-sky-600 text-white",
  Completed:   "bg-teal-600 text-white",
  Cancelled:   "bg-slate-500 text-white",
  Reopened:    "bg-violet-600 text-white",
}

type SortColumn =
  | "datePlanned"
  | "datePostponed"
  | "initializedDate"
  | "auditNumber"
  | "field"
  | "auditors"
  | "status"
const DATE_SORT_COLUMNS: SortColumn[] = ["datePlanned", "datePostponed", "initializedDate"]

export type AuditPlanRow = {
  id: string
  datePlanned: string
  datePostponed: string | null
  initializedDate: string | null
  auditNumber: string
  field: string
  ct: string
  auditors: string
  status: keyof typeof statusStyles | string
}

export type AuditPlanDocumentRow = {
  id: number
  fileName: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedByName: string | null
  createdAt: string
  /** "auditor" | "auditee" — null (eski kayıt) "auditor" olarak ele alınır. */
  source: string | null
  submitterName: string | null
}

export type AuditPlanFindingRow = {
  id: number
  findingCode: string
  /** Level1 | Level2 | Observation — yalnızca SACA/SAFA DIŞINDAKİ audit type'larında dolu;
   * SACA/SAFA'da tek sınıflandırma findingCategory'dir, bu alan null'dur. */
  findingLevel: string | null
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde dolu, diğerlerinde null. */
  findingCategory: string | null
  explanation: string
  status: string
  dueDate: string | null
  isManual: boolean
  assignedTo: { id: number; name: string | null; department: string | null } | null
}

export type AuditPlanHistoryRow = {
  id: number
  createdAt: string
  eventType: string
  statusFrom: string | null
  statusTo: string | null
  note: string | null
  actorName: string | null
}

export function historyEventText(h: AuditPlanHistoryRow): string {
  if (h.note?.trim()) return h.note.trim()
  const actor = h.actorName ?? "Bilinmeyen kullanıcı"
  if (h.eventType === "REOPENED") return `Denetim ${actor} tarafından yeniden açıldı.`
  return `${actor} tarafından durum "${h.statusFrom ?? "—"}" → "${h.statusTo ?? "—"}" olarak güncellendi.`
}

export const findingLevelStyles: Record<string, { label: string; cls: string }> = {
  Level1: { label: "Level 1", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" },
  Level2: { label: "Level 2", cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800" },
  Observation: { label: "Gözlem", cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
}

export type AuditPlanDetail = {
  id: string
  title: string
  auditNumber: string
  field: string
  auditCategoryTypeId: number
  auditSubCategoryTypeId: number | null
  auditNumberPrefix: string | null
  categoryName: string
  subCategoryName: string | null
  datePlanned: string
  datePostponed: string | null
  initializedDate: string | null
  ct: string
  remarks: string | null
  status: string
  cancellationReason: string | null
  auditors: { id: number; name: string }[]
  auditees: { id: number; name: string }[]
  /// Denetlenen olarak bireylere ek olarak (veya onların yerine) atanmış Group/Department isimleri
  auditeeDepartments: string[]
  assignedChecklists: {
    assignmentId: number
    checklistId: number
    title: string
    checklistNumber: string
    checklistType?: string
    revision: string
    itemCount: number
    assignedAt: string
  }[]
  createdAt: string
  updatedAt: string
}

export function normalizeAuditDetail(
  data: AuditPlanDetail & { error?: string }
): AuditPlanDetail {
  return {
    ...data,
    assignedChecklists: data.assignedChecklists ?? [],
  }
}

export function formatDetailDate(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(d)
  } catch {
    return iso
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Türkçe karakter/case-insensitive karşılaştırma için normalize eder (Ü/Ç/Ö/Ğ/Ş/İ/I dahil). */
function normalizeSearchText(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim()
}

export function EmployeeMultiSelect({
  id,
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Select…",
}: {
  id: string
  label: string
  options: { id: number; label: string }[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const summary =
    selectedIds.length === 0
      ? placeholder
      : selectedIds
          .map((sid) => options.find((o) => o.id === sid)?.label ?? `#${sid}`)
          .join(", ")

  const toggle = (calisanId: number) => {
    if (selectedIds.includes(calisanId)) {
      onChange(selectedIds.filter((x) => x !== calisanId))
    } else {
      onChange([...selectedIds, calisanId])
    }
  }

  const filteredOptions = React.useMemo(() => {
    const q = normalizeSearchText(query)
    if (!q) return options
    return options.filter((o) => normalizeSearchText(o.label).includes(q))
  }, [options, query])

  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "border-input h-9 w-full justify-between px-3 font-normal shadow-xs",
              selectedIds.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">{summary}</span>
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <div className="flex flex-col gap-0">
            <div className="relative border-b px-2 py-1.5">
              <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara… (isim / soyisim)"
                className="h-8 border-0 pl-7 shadow-none focus-visible:ring-0"
                autoFocus
              />
            </div>
            {/* Native overflow scroll + manuel onWheel: bu bileşen Dialog içinde açıldığında
                Dialog'un scroll-lock'u (react-remove-scroll) global wheel event'ini
                preventDefault ediyor; scrollTop'u elle güncelleyerek fare tekerleği
                kaydırmasını garantiye alıyoruz. Klavye navigasyonu ve seçili kişiler korunur. */}
            <div
              className="max-h-[min(240px,40vh)] overflow-y-auto overscroll-contain"
              onWheel={(e) => {
                e.currentTarget.scrollTop += e.deltaY
              }}
            >
              <div className="flex flex-col gap-0.5 p-2">
                {options.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                    Çalışan listesi yüklenemedi.
                  </p>
                ) : filteredOptions.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                    Sonuç yok.
                  </p>
                ) : (
                  filteredOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="hover:bg-muted/80 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5"
                    >
                      <Checkbox
                        checked={selectedIds.includes(opt.id)}
                        onCheckedChange={() => toggle(opt.id)}
                      />
                      <span className="text-sm leading-none">{opt.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function AuditPlanClient() {
  const { t } = useLanguage()
  const router = useRouter()
  const uid = React.useId()
  const [keyword, setKeyword] = React.useState("")
  const [rows, setRows] = React.useState<AuditPlanRow[]>([])
  const [listLoading, setListLoading] = React.useState(true)
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null)
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")

  const toggleSort = (column: SortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"))
        return prevCol
      }
      setSortDir("asc")
      return column
    })
  }

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="size-3.5 opacity-50" />
    return sortDir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
  }

  // ─── Gelişmiş filtreler: Yıl / Departman (Field) / Status ──────────────────
  const ALL = "__all__"
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [yearFilter, setYearFilter] = React.useState<string>(ALL)
  const [fieldFilter, setFieldFilter] = React.useState<string>(ALL)
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL)

  const yearOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const d = parseDdMmYyyyToUtcDate(r.datePlanned)
      if (d) set.add(String(d.getUTCFullYear()))
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [rows])

  const fieldOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.field?.trim()) set.add(r.field.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const statusOptions = React.useMemo(() => Object.keys(statusStyles), [])

  const activeFilterCount = [yearFilter, fieldFilter, statusFilter].filter((v) => v !== ALL).length

  const clearFilters = () => {
    setYearFilter(ALL)
    setFieldFilter(ALL)
    setStatusFilter(ALL)
  }

  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AuditPlanDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // ─── Denetim dosyaları (checklist eklerinden bağımsız, Audit ID'ye bağlı) ──
  const [documents, setDocuments] = React.useState<AuditPlanDocumentRow[]>([])
  const [documentsLoading, setDocumentsLoading] = React.useState(false)
  const [documentsUploading, setDocumentsUploading] = React.useState(false)
  const [deleteDocTarget, setDeleteDocTarget] = React.useState<AuditPlanDocumentRow | null>(null)
  const [deletingDoc, setDeletingDoc] = React.useState(false)

  const reloadDocuments = React.useCallback(async () => {
    if (!detailEntryId) return
    setDocumentsLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/documents`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setDocuments(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setDocumentsLoading(false)
    }
  }, [detailEntryId])

  React.useEffect(() => {
    if (!detailEntryId) {
      setDocuments([])
      return
    }
    void reloadDocuments()
  }, [detailEntryId, reloadDocuments])

  const handleAddDocuments = async (fileList: FileList) => {
    if (!detailEntryId || fileList.length === 0) return
    setDocumentsUploading(true)
    try {
      const files = Array.from(fileList)
      const uploaded = await uploadAuditPlanDocumentsDirect(detailEntryId, files)
      const res = await fetch(`/api/audit-plan/${detailEntryId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Dosya kaydedilemedi.")
      toast.success(`${uploaded.length} dosya eklendi.`)
      await reloadDocuments()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dosya yüklenemedi.")
    } finally {
      setDocumentsUploading(false)
    }
  }

  const confirmDeleteDocument = async () => {
    if (!deleteDocTarget || !detailEntryId) return
    setDeletingDoc(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/documents/${deleteDocTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success("Dosya silindi.")
      setDeleteDocTarget(null)
      await reloadDocuments()
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeletingDoc(false)
    }
  }

  // ─── Bulgu / notlar — manuel bulgu ekleme (mevcut standart Finding sistemini kullanır) ──
  const [findings, setFindings] = React.useState<AuditPlanFindingRow[]>([])
  const [findingsLoading, setFindingsLoading] = React.useState(false)
  const [findingDialogOpen, setFindingDialogOpen] = React.useState(false)
  const [findingLevelInput, setFindingLevelInput] = React.useState("Level1")
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde gösterilir/gönderilir. */
  const [findingCategoryInput, setFindingCategoryInput] = React.useState("CAT1")
  const [findingExplanation, setFindingExplanation] = React.useState("")
  const [findingReference, setFindingReference] = React.useState("")
  const [findingAssignedToId, setFindingAssignedToId] = React.useState<number | undefined>(undefined)
  /** dd.mm.yyyy — yalnızca SACA/SAFA denetimlerinde gösterilir/zorunludur (bkz. manage-audit-client.tsx). */
  const [findingDueDateInput, setFindingDueDateInput] = React.useState("")
  const [findingAssignees, setFindingAssignees] = React.useState<{ id: number; label: string }[]>([])
  const [creatingFinding, setCreatingFinding] = React.useState(false)

  const reloadFindings = React.useCallback(async () => {
    if (!detailEntryId) return
    setFindingsLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/findings`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setFindings(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setFindingsLoading(false)
    }
  }, [detailEntryId])

  React.useEffect(() => {
    if (!detailEntryId) {
      setFindings([])
      return
    }
    void reloadFindings()
  }, [detailEntryId, reloadFindings])

  React.useEffect(() => {
    if (!findingDialogOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/calisanlar")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as CalisanLite[]
        if (cancelled) return
        setFindingAssignees(
          data.map((c) => ({
            id: c.id,
            label: [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || `ID ${c.id}`,
          }))
        )
      } catch {
        if (!cancelled) setFindingAssignees([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [findingDialogOpen])

  const openFindingDialog = () => {
    setFindingLevelInput("Level1")
    setFindingCategoryInput("CAT1")
    setFindingExplanation("")
    setFindingReference("")
    setFindingAssignedToId(undefined)
    setFindingDueDateInput("")
    setFindingDialogOpen(true)
  }

  const submitFinding = async () => {
    if (!detailEntryId) return
    if (!findingExplanation.trim()) {
      toast.error("Açıklama zorunludur.")
      return
    }
    const isSacaSafa = isSacaOrSafaAuditCategory(detail?.categoryName)
    let dueDateIso: string | null = null
    if (isSacaSafa) {
      // SACA/SAFA'da Level olmadığı için otomatik vade hesaplanamaz — Due Date manuel ve
      // zorunludur (ortak DatePicker/date-input mask sistemi ile aynı doğrulama).
      const parsed = findingDueDateInput.trim() ? parseDdMmYyyyToUtcDate(findingDueDateInput.trim()) : null
      if (!parsed) {
        toast.error("Geçerli bir Due Date giriniz (gg.aa.yyyy).")
        return
      }
      dueDateIso = parsed.toISOString()
    }
    setCreatingFinding(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // SACA/SAFA'da Level artık gönderilmez — sunucu zaten yok sayar.
          findingLevel: isSacaSafa ? undefined : findingLevelInput,
          findingCategory: isSacaSafa ? findingCategoryInput : null,
          explanation: findingExplanation.trim(),
          reference: findingReference.trim() || null,
          assignedToId: findingAssignedToId ?? null,
          ...(isSacaSafa ? { dueDate: dueDateIso } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bulgu kaydedilemedi.")
      toast.success(`Bulgu eklendi (${data.findingCode ?? ""}).`)
      setFindingDialogOpen(false)
      await reloadFindings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulgu kaydedilemedi.")
    } finally {
      setCreatingFinding(false)
    }
  }

  // ─── Geçmiş / Audit History (Reopen ve durum değişikliği olayları) ────────
  const [historyRows, setHistoryRows] = React.useState<AuditPlanHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)

  const reloadHistory = React.useCallback(async () => {
    if (!detailEntryId) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/history`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setHistoryRows(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setHistoryLoading(false)
    }
  }, [detailEntryId])

  React.useEffect(() => {
    if (!detailEntryId) {
      setHistoryRows([])
      return
    }
    void reloadHistory()
  }, [detailEntryId, reloadHistory])

  // ─── Cancelled ─────────────────────────────────────────────────────────────
  const [cancelTargetId, setCancelTargetId] = React.useState<string | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")
  const [cancelling, setCancelling] = React.useState(false)

  const openCancelDialog = (rowId: string) => {
    setCancelTargetId(rowId)
    setCancelReason("")
  }

  const confirmCancel = async () => {
    if (!cancelTargetId) return
    if (!cancelReason.trim()) {
      toast.error("İptal nedeni zorunludur.")
      return
    }
    setCancelling(true)
    try {
      const res = await fetch(`/api/audit-plan/${cancelTargetId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Denetim iptal edilemedi.")
      toast.success("Denetim iptal edildi.")
      const targetId = cancelTargetId
      setCancelTargetId(null)
      setCancelReason("")
      await refreshRows()
      if (detailEntryId === targetId) {
        await Promise.all([silentRefetchDetail(), reloadHistory()])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Denetim iptal edilemedi.")
    } finally {
      setCancelling(false)
    }
  }

  // ─── Reopen ────────────────────────────────────────────────────────────────
  const [reopenDialogOpen, setReopenDialogOpen] = React.useState(false)
  const [reopening, setReopening] = React.useState(false)

  const confirmReopen = async () => {
    if (!detailEntryId) return
    setReopening(true)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/reopen`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Denetim yeniden açılamadı.")
      toast.success("Denetim yeniden açıldı.")
      setReopenDialogOpen(false)
      await Promise.all([silentRefetchDetail(), reloadHistory(), refreshRows()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Denetim yeniden açılamadı.")
    } finally {
      setReopening(false)
    }
  }

  // ─── Initial Report / Full Report ──────────────────────────────────────────
  const [reportGenerating, setReportGenerating] = React.useState<"initial" | "full" | null>(null)

  const generateReport = async (kind: "initial" | "full") => {
    if (!detailEntryId) return
    setReportGenerating(kind)
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}/report`, { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as (AuditPlanReportData & { error?: string }) | null
      if (!res.ok || !data) throw new Error(data?.error || "Rapor verileri alınamadı.")
      if (kind === "initial") downloadInitialReportPdf(data)
      else downloadFullReportPdf(data)
      toast.success(kind === "initial" ? "İlk rapor indirildi." : "Tam rapor indirildi.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rapor oluşturulamadı.")
    } finally {
      setReportGenerating(null)
    }
  }

  // Satır ⋮ menüsünden veya Detay panelindeki "Sil" butonundan tetiklenebilir — ikisi de
  // aynı hedef state'i (id + gösterim için auditNumber) set eder, aynı onay dialogunu kullanır.
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; auditNumber: string } | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false)

  const [assignOpen, setAssignOpen] = React.useState(false)
  const [checklistTemplates, setChecklistTemplates] = React.useState<AuditChecklistListRow[]>([])
  const [assignListLoading, setAssignListLoading] = React.useState(false)
  const [pickChecklistId, setPickChecklistId] = React.useState<string>("")
  const [assignSubmitting, setAssignSubmitting] = React.useState(false)

  const [auditFormOpen, setAuditFormOpen] = React.useState(false)
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null)
  const editSubRestoreRef = React.useRef<number | null>(null)
  const [plannedDate, setPlannedDate] = React.useState("")
  const [auditCategoryTypeId, setAuditCategoryTypeId] = React.useState<number | undefined>(
    undefined
  )
  const [auditSubCategoryTypeId, setAuditSubCategoryTypeId] = React.useState<number | undefined>(
    undefined
  )
  const [categoryOptions, setCategoryOptions] = React.useState<{ id: number; name: string }[]>([])
  const [subCategoryOptions, setSubCategoryOptions] = React.useState<{ id: number; name: string }[]>([])
  const [subCategoriesLoading, setSubCategoriesLoading] = React.useState(false)
  const [auditPrefix, setAuditPrefix] = React.useState("")
  const [auditorIds, setAuditorIds] = React.useState<number[]>([])
  const [auditeeIds, setAuditeeIds] = React.useState<number[]>([])
  const [remarks, setRemarks] = React.useState("")
  const [employees, setEmployees] = React.useState<{ id: number; label: string }[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const refreshRows = React.useCallback(async () => {
    try {
      const res = await fetch("/api/audit-plan")
      const parsed = (await res.json().catch(() => null)) as
        | AuditPlanRow[]
        | { error?: string }
        | null
      if (!res.ok) {
        const msg =
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          typeof parsed.error === "string" &&
          parsed.error.trim()
            ? parsed.error.trim()
            : res.status === 503
              ? "Veritabanına ulaşılamıyor. PostgreSQL/Supabase bağlantısını kontrol edin."
              : `Denetim listesi yüklenemedi (HTTP ${res.status}).`
        toast.error(msg)
        setRows([])
        return
      }
      setRows(Array.isArray(parsed) ? parsed : [])
    } catch {
      toast.error("Ağ hatası. Sayfayı yenileyin veya bağlantınızı kontrol edin.")
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshRows()
  }, [refreshRows])

  const updateStatus = React.useCallback(async (rowId: string, status: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/audit-plan/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOnly: true, status, ...extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === "string" && data.error.trim() ? data.error.trim() : "Durum güncellenemedi.")
        return false
      }
      toast.success(`Durum: ${status}`)
      await refreshRows()
      return true
    } catch {
      toast.error("Bağlantı hatası.")
      return false
    }
  }, [refreshRows])

  // ─── Postponed (Postponed Date modal zorunlu) — hem tablo satırı aksiyonundan hem de
  // Manage Audit'in kendi "Postponed" düğmesinden AYNI shared dialog kullanılır ─────────
  const [postponeTargetId, setPostponeTargetId] = React.useState<string | null>(null)
  const [postponing, setPostponing] = React.useState(false)
  const postponeTargetRow = React.useMemo(
    () => rows.find((r) => r.id === postponeTargetId) ?? null,
    [rows, postponeTargetId]
  )

  const openPostponeDialog = (rowId: string) => setPostponeTargetId(rowId)

  const confirmPostponeRow = async (postponedDate: string, reason: string) => {
    if (!postponeTargetId) return
    setPostponing(true)
    try {
      const ok = await updateStatus(postponeTargetId, "Postponed", {
        datePostponed: postponedDate,
        postponementReason: reason || undefined,
      })
      if (ok) setPostponeTargetId(null)
    } finally {
      setPostponing(false)
    }
  }

  React.useEffect(() => {
    if (!detailEntryId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetail(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/audit-plan/${detailEntryId}`, { cache: "no-store" })
        const data = (await res.json()) as AuditPlanDetail & { error?: string }
        if (cancelled) return
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Detay yüklenemedi.")
          setDetail(null)
          return
        }
        setDetail(normalizeAuditDetail(data))
      } catch {
        if (!cancelled) {
          toast.error("Detay yüklenemedi.")
          setDetail(null)
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailEntryId])

  const silentRefetchDetail = React.useCallback(async () => {
    if (!detailEntryId) return
    try {
      const res = await fetch(`/api/audit-plan/${detailEntryId}`, { cache: "no-store" })
      const data = (await res.json()) as AuditPlanDetail & { error?: string }
      if (res.ok) setDetail(normalizeAuditDetail(data))
    } catch {
      /* ignore */
    }
  }, [detailEntryId])

  React.useEffect(() => {
    if (!assignOpen) return
    let cancelled = false
    setAssignListLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/audit-checklists", { cache: "no-store" })
        const data = (await res.json()) as AuditChecklistListRow[]
        if (!cancelled && res.ok) setChecklistTemplates(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setChecklistTemplates([])
      } finally {
        if (!cancelled) setAssignListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignOpen])

  React.useEffect(() => {
    if (!auditFormOpen) return
    if (editingEntryId) return
    setPlannedDate(todayLocalDdMmYyyy())
    setAuditCategoryTypeId(undefined)
    setAuditSubCategoryTypeId(undefined)
    setSubCategoryOptions([])
    setAuditPrefix("")
    setAuditorIds([])
    setAuditeeIds([])
    setRemarks("")
  }, [auditFormOpen, editingEntryId])

  React.useEffect(() => {
    if (!auditFormOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/calisanlar")
        if (!res.ok || cancelled) return
        const data = (await res.json()) as CalisanLite[]
        if (cancelled) return
        const opts = data.map((c) => {
          const name = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
          return {
            id: c.id,
            label: name || `ID ${c.id}`,
          }
        })
        setEmployees(opts)
      } catch {
        if (!cancelled) setEmployees([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auditFormOpen])

  React.useEffect(() => {
    if (!auditFormOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/audit-category-types", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          id: number
          name: string
          isActive?: boolean
        }[]
        if (cancelled) return
        const opts = (Array.isArray(data) ? data : [])
          .filter((r) => r.isActive !== false)
          .map((r) => ({ id: r.id, name: r.name }))
        setCategoryOptions(opts)
      } catch {
        if (!cancelled) setCategoryOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auditFormOpen])

  React.useEffect(() => {
    if (!auditFormOpen || !auditCategoryTypeId) {
      setSubCategoryOptions([])
      if (!editingEntryId) setAuditSubCategoryTypeId(undefined)
      return
    }
    let cancelled = false
    setSubCategoriesLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/audit-subcategory-types?categoryTypeId=${auditCategoryTypeId}`,
          { cache: "no-store" }
        )
        if (!res.ok || cancelled) {
          if (!cancelled) setSubCategoryOptions([])
          return
        }
        const data = (await res.json()) as { id: number; name: string }[]
        if (cancelled) return
        const opts = Array.isArray(data) ? data : []
        setSubCategoryOptions(opts)
        if (!editingEntryId) {
          setAuditSubCategoryTypeId(undefined)
        } else {
          const want = editSubRestoreRef.current
          editSubRestoreRef.current = null
          if (want !== null && opts.some((s) => s.id === want)) {
            setAuditSubCategoryTypeId(want)
          } else {
            setAuditSubCategoryTypeId(undefined)
          }
        }
      } catch {
        if (!cancelled) setSubCategoryOptions([])
      } finally {
        if (!cancelled) setSubCategoriesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auditFormOpen, auditCategoryTypeId, editingEntryId])

  const openManageFromDetail = () => {
    if (!detail) return
    editSubRestoreRef.current = detail.auditSubCategoryTypeId ?? null
    setEditingEntryId(detail.id)
    setPlannedDate(detail.datePlanned)
    setAuditCategoryTypeId(detail.auditCategoryTypeId)
    setAuditSubCategoryTypeId(undefined)
    setAuditPrefix(detail.auditNumberPrefix?.trim() ?? "")
    setAuditorIds(detail.auditors.map((a) => a.id))
    setAuditeeIds(detail.auditees.map((a) => a.id))
    setRemarks(detail.remarks ?? "")
    setAuditFormOpen(true)
  }

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auditCategoryTypeId) {
      toast.error("Kategori seçin.")
      return
    }
    if (subCategoryOptions.length > 0 && !auditSubCategoryTypeId) {
      toast.error("Alt kategori seçin.")
      return
    }
    setSubmitting(true)
    try {
      const isEdit = editingEntryId !== null
      const res = await fetch(
        isEdit ? `/api/audit-plan/${editingEntryId}` : "/api/audit-plan",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plannedDate,
            auditCategoryTypeId,
            ...(auditSubCategoryTypeId ? { auditSubCategoryTypeId } : {}),
            auditNumberPrefix: auditPrefix.trim() || undefined,
            remarks: remarks.trim() || undefined,
            auditorIds,
            auditeeIds,
          }),
        }
      )
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof errJson.error === "string"
            ? errJson.error
            : isEdit
              ? "Güncellenemedi."
              : "Kayıt oluşturulamadı."
        toast.error(msg)
        return
      }
      toast.success(isEdit ? "Kayıt güncellendi." : "Denetim kaydı oluşturuldu.")
      const savedId = editingEntryId
      setAuditFormOpen(false)
      setEditingEntryId(null)
      await refreshRows()
      if (isEdit && savedId && detailEntryId === savedId) {
        try {
          const r = await fetch(`/api/audit-plan/${savedId}`, { cache: "no-store" })
          const d = (await r.json()) as AuditPlanDetail & { error?: string }
          if (r.ok) setDetail(normalizeAuditDetail(d))
        } catch {
          /* ignore */
        }
      }
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/audit-plan/${deleteTarget.id}`, { method: "DELETE" })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof errJson.error === "string" ? errJson.error : "Silinemedi."
        toast.error(msg)
        return
      }
      toast.success("Kayıt silindi.")
      setDeleteTarget(null)
      if (detailEntryId === deleteTarget.id) setDetailEntryId(null)
      await refreshRows()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const availableChecklistsForAssign = React.useMemo(() => {
    const assigned = new Set(detail?.assignedChecklists?.map((c) => c.checklistId) ?? [])
    return checklistTemplates.filter((t) => t.isActive && !assigned.has(t.id))
  }, [checklistTemplates, detail?.assignedChecklists])

  const handleUnassignChecklist = async (checklistId: number) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/audit-plan/${detail.id}/checklists/${checklistId}`, {
        method: "DELETE",
      })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof errJson.error === "string" ? errJson.error : "Kaldırılamadı."
        toast.error(msg)
        return
      }
      toast.success("Checklist kaldırıldı.")
      await silentRefetchDetail()
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }

  const handleAssignChecklistSubmit = async () => {
    if (!detail || !pickChecklistId) {
      toast.error("Checklist seçin.")
      return
    }
    const auditChecklistId = Number(pickChecklistId)
    if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1) return
    setAssignSubmitting(true)
    try {
      const res = await fetch(`/api/audit-plan/${detail.id}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditChecklistId }),
      })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof errJson.error === "string" ? errJson.error : "Atanamadı."
        toast.error(msg)
        return
      }
      toast.success("Checklist atandı.")
      setAssignOpen(false)
      setPickChecklistId("")
      await silentRefetchDetail()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setAssignSubmitting(false)
    }
  }

  const filtered = React.useMemo(() => {
    const q = keyword.trim().toLowerCase()
    let base = !q
      ? rows
      : rows.filter((r) =>
          [r.auditNumber, r.field, r.auditors, r.status, r.datePlanned, r.ct]
            .join(" ").toLowerCase().includes(q)
        )

    if (yearFilter !== ALL) {
      base = base.filter((r) => {
        const d = parseDdMmYyyyToUtcDate(r.datePlanned)
        return d ? String(d.getUTCFullYear()) === yearFilter : false
      })
    }
    if (fieldFilter !== ALL) {
      base = base.filter((r) => r.field === fieldFilter)
    }
    if (statusFilter !== ALL) {
      base = base.filter((r) => r.status === statusFilter)
    }

    if (!sortColumn) return base

    const isDateColumn = DATE_SORT_COLUMNS.includes(sortColumn)
    // Tarih sütunları: DD.MM.YYYY metnini gerçek tarih değerine çevirip kronolojik
    // sıralar (string sıralaması "31.01.2026" ile "01.02.2026" gibi durumlarda
    // yanlış sonuç verir). Diğer sütunlar: sayı-duyarlı alfabetik sıralama (ör.
    // "AP-2" "AP-10"'dan önce gelir).
    const withKey = base.map((r) => {
      const raw = r[sortColumn] as string | null
      const key = isDateColumn
        ? (raw ? parseDdMmYyyyToUtcDate(raw)?.getTime() ?? null : null)
        : (raw?.trim() || null)
      return { row: r, key }
    })
    withKey.sort((a, b) => {
      // Boş/ayrıştırılamayan değerler sona (hangi sıralama yönünde olursa olsun) atılır.
      if (a.key === null && b.key === null) return 0
      if (a.key === null) return 1
      if (b.key === null) return -1
      const cmp =
        typeof a.key === "number" && typeof b.key === "number"
          ? a.key - b.key
          : String(a.key).localeCompare(String(b.key), undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
    return withKey.map((x) => x.row)
  }, [rows, keyword, sortColumn, sortDir, yearFilter, fieldFilter, statusFilter])

  // ─── Export ───────────────────────────────────────────────────────────────

  const EXPORT_COLS = [
    { header: "Audit Number",      key: "auditNumber"     },
    { header: "Date (Planned)",    key: "datePlanned"     },
    { header: "Date (Postponed)",  key: "datePostponed"   },
    { header: "Initialized Date",  key: "initializedDate" },
    { header: "Field",             key: "field"           },
    { header: "C / T",             key: "ct"              },
    { header: "Auditors",          key: "auditors"        },
    { header: "Status",            key: "status"          },
  ] as const

  type ExportKey = typeof EXPORT_COLS[number]["key"]

  const toExportRows = (src: AuditPlanRow[]) =>
    src.map((r): Record<ExportKey, string> => ({
      auditNumber:     r.auditNumber,
      datePlanned:     r.datePlanned,
      datePostponed:   r.datePostponed ?? "—",
      initializedDate: r.initializedDate ?? "—",
      field:           r.field,
      ct:              r.ct,
      auditors:        r.auditors,
      status:          r.status,
    }))

  const handleExportExcel = async () => {
    const { utils, writeFile } = await import("xlsx")
    const data = toExportRows(filtered)
    const ws = utils.json_to_sheet(data, { header: EXPORT_COLS.map((c) => c.key) })
    EXPORT_COLS.forEach((col, i) => {
      const cell = utils.encode_cell({ r: 0, c: i })
      if (ws[cell]) ws[cell].v = col.header
    })
    ws["!cols"] = [
      { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 30 }, { wch: 10 }, { wch: 35 }, { wch: 14 },
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, "Audit Plan")
    writeFile(wb, `Audit_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportPdf = async () => {
    const { jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")
    const data = toExportRows(filtered)
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    doc.setFontSize(14)
    doc.text("Audit Plan", 14, 14)
    doc.setFontSize(9)
    doc.text(`Dışa aktarma: ${new Date().toLocaleDateString("tr-TR")}  |  ${filtered.length} kayıt`, 14, 21)
    autoTable(doc, {
      startY: 27,
      head: [EXPORT_COLS.map((c) => c.header)],
      body: data.map((r) => EXPORT_COLS.map((c) => r[c.key])),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 250, 247] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 24 },
        4: { cellWidth: 40 },
        5: { cellWidth: 14 },
        6: { cellWidth: 50 },
        7: { cellWidth: 18 },
      },
    })
    doc.save(`Audit_Plan_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <>
      <SetWorkspacePageTitle title={t.nav.auditPlan} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/85 px-4 pb-4 pt-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Audit Plan</h1>
                <div className="text-muted-foreground text-xs">
                  {filtered.length.toLocaleString("tr-TR")} / {rows.length.toLocaleString("tr-TR")} kayıt
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Denetim planı — yalnızca yöneticiler görür. Kategoriler{" "}
                <Link
                  href="/configurations/audit-settings"
                  className="text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Configurations → Audit Settings
                </Link>{" "}
                üzerinden yönetilir (HR / Quality).
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Popover open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="relative h-9 w-9"
                      title="Gelişmiş filtre"
                    >
                      <Filter className="size-4" />
                      {activeFilterCount > 0 && (
                        <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 space-y-3 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Gelişmiş Filtreler</p>
                      {activeFilterCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={clearFilters}
                        >
                          Filtreleri Temizle
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Yıl</Label>
                      <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Tüm yıllar</SelectItem>
                          {yearOptions.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Departman / Field</Label>
                      <Select value={fieldFilter} onValueChange={setFieldFilter}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value={ALL}>Tüm departmanlar</SelectItem>
                          {fieldOptions.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Tüm statüler</SelectItem>
                          {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="relative min-w-[220px] max-w-lg flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Anahtar kelime ile süz…"
                    className="h-9 pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" disabled title="Yakında">
                  <Share2 className="mr-1.5 size-4" />
                  Share Page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title="Yakında"
                >
                  <CalendarRange className="mr-1.5 size-4" />
                  Monthly
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title="Yakında"
                >
                  <List className="mr-1.5 size-4" />
                  Consolidated
                </Button>

                {/* ── Export ── */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={filtered.length === 0}
                      title="Dışa aktar"
                    >
                      <Download className="mr-1.5 size-4" />
                      Export
                      <ChevronDown className="ml-1 size-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void handleExportExcel()}>
                      <FileSpreadsheet className="mr-2 size-4 text-emerald-600" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExportPdf()}>
                      <FileText className="mr-2 size-4 text-red-500" />
                      PDF (.pdf)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setEditingEntryId(null)
                    setAuditFormOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 size-4" />
                  New Audit
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <ScrollArea className="h-[min(70vh,760px)]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 px-2 text-center" />
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("datePlanned")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Tarihe göre sırala"
                    >
                      Date (Planned)
                      {renderSortIcon("datePlanned")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("datePostponed")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Tarihe göre sırala"
                    >
                      Date (Postponed)
                      {renderSortIcon("datePostponed")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("initializedDate")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Tarihe göre sırala"
                    >
                      Initialized Date
                      {renderSortIcon("initializedDate")}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
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
                  <TableHead>
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
                  <TableHead className="whitespace-nowrap text-center">C / T</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("auditors")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Auditors
                      {renderSortIcon("auditors")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="hover:text-foreground ml-auto inline-flex items-center gap-1"
                      title="Sırala"
                    >
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground h-32 text-center">
                      Yükleniyor…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground h-32 text-center">
                      {rows.length === 0
                        ? "Henüz denetim kaydı yok. «New Audit» ile ekleyebilirsiniz."
                        : "Aramanızla eşleşen kayıt yok."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/compliance/audit-plan/${row.id}/manage`)}
                    >
                      <TableCell className="w-10 px-1 align-middle" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              aria-label="İşlemler"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem asChild>
                              <Link href={`/compliance/audit-plan/${row.id}/session`}>
                                <ClipboardCheck className="mr-2 size-4 text-emerald-600" />
                                Audit Screen
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/compliance/audit-plan/${row.id}/manage`}>
                                <ClipboardList className="mr-2 size-4" />
                                Manage Audit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {row.status !== "Planned" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Planned")}>
                                <FileText className="mr-2 size-4 text-blue-500" />
                                Planned
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Initialized" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Initialized")}>
                                <Clock className="mr-2 size-4 text-emerald-600" />
                                Initialized
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Postponed" && (
                              <DropdownMenuItem onClick={() => openPostponeDialog(row.id)}>
                                <CalendarRange className="mr-2 size-4 text-sky-600" />
                                Postponed
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Completed" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Completed")}>
                                <CheckCircle2 className="mr-2 size-4 text-teal-600" />
                                Completed
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Cancelled" && (
                              <DropdownMenuItem onClick={() => openCancelDialog(row.id)}>
                                <Ban className="mr-2 size-4 text-red-600" />
                                Cancelled
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ id: row.id, auditNumber: row.auditNumber })}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {row.datePlanned}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {row.datePostponed ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.initializedDate ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="hover:text-primary hover:underline underline-offset-2">{row.auditNumber}</span>
                      </TableCell>
                      <TableCell className="max-w-[240px] text-sm">{row.field}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{row.ct}</TableCell>
                      <TableCell className="max-w-[240px] text-sm">
                        {row.auditors?.trim() ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate" title={row.auditors}>
                                {row.auditors}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6} className="max-w-[420px]">
                              <span className="whitespace-pre-wrap">{row.auditors}</span>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            statusStyles[row.status] ?? "bg-slate-500 text-white"
                          )}
                        >
                          {row.status}
                        </span>
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

      <Dialog
        open={auditFormOpen}
        onOpenChange={(open) => {
          setAuditFormOpen(open)
          if (!open) setEditingEntryId(null)
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-0 px-6 pt-6 pr-14 text-left">
            <DialogTitle>
              {editingEntryId ? "Denetimi düzenle" : "Create New Audit"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSaveAudit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 pb-2 pt-2">
              <div className="space-y-2">
                <Label>Planned Date</Label>
                <DatePicker
                  value={plannedDate}
                  onChange={setPlannedDate}
                  placeholder="dd.mm.yyyy"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`audit-cat-${uid}`}>Category</Label>
                <AuditCategoryCombobox
                  id={`audit-cat-${uid}`}
                  options={categoryOptions}
                  value={auditCategoryTypeId}
                  onChange={(id) => {
                    setAuditCategoryTypeId(id)
                    setAuditSubCategoryTypeId(undefined)
                  }}
                  placeholder="Select…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`audit-sub-${uid}`}>Sub-Category</Label>
                <AuditCategoryCombobox
                  id={`audit-sub-${uid}`}
                  options={subCategoryOptions}
                  value={auditSubCategoryTypeId}
                  onChange={setAuditSubCategoryTypeId}
                  placeholder={
                    !auditCategoryTypeId
                      ? "Select category first…"
                      : subCategoriesLoading
                        ? "Loading…"
                        : subCategoryOptions.length === 0
                          ? "No sub-categories"
                          : "Select…"
                  }
                  disabled={
                    !auditCategoryTypeId ||
                    subCategoriesLoading ||
                    subCategoryOptions.length === 0
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`audit-num-${uid}`}>Audit Number</Label>
                <Input
                  id={`audit-num-${uid}`}
                  value={auditPrefix}
                  onChange={(e) => setAuditPrefix(e.target.value)}
                  placeholder="Write a prefix"
                />
              </div>

              <EmployeeMultiSelect
                id={`audit-auditors-${uid}`}
                label="Auditors"
                options={employees}
                selectedIds={auditorIds}
                onChange={setAuditorIds}
              />

              <EmployeeMultiSelect
                id={`audit-auditees-${uid}`}
                label="Auditees"
                options={employees}
                selectedIds={auditeeIds}
                onChange={setAuditeeIds}
              />

              <div className="space-y-2">
                <Label htmlFor={`audit-remarks-${uid}`}>Remarks</Label>
                <Textarea
                  id={`audit-remarks-${uid}`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="min-h-[88px] resize-y"
                  placeholder=""
                />
              </div>
            </div>

            <DialogFooter className="mt-auto shrink-0 gap-2 border-t border-border bg-background px-6 py-4 sm:justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? "Saving…" : editingEntryId ? "Kaydet" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={detailEntryId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEntryId(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-border shrink-0 space-y-3 border-b px-6 pb-4 pt-6 pr-14 text-left">
            {detailLoading ? (
              <>
                <SheetTitle className="text-lg">Yükleniyor…</SheetTitle>
                <SheetDescription className="sr-only">Denetim detayı</SheetDescription>
              </>
            ) : detail ? (
              <>
                <SheetTitle className="text-lg leading-snug">{detail.title}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                      statusStyles[detail.status] ?? "bg-slate-500 text-white"
                    )}
                  >
                    {detail.status}
                  </span>
                </div>
                <SheetDescription className="sr-only">
                  {detail.auditNumber}, {detail.field}
                </SheetDescription>
              </>
            ) : (
              <>
                <SheetTitle className="text-lg">Detay bulunamadı</SheetTitle>
                <SheetDescription>Kayıt yüklenemedi.</SheetDescription>
              </>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {detail && !detailLoading && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="gap-1.5"
                    onClick={openManageFromDetail}
                  >
                    <Settings className="size-4" />
                    Yönet
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => detail && setDeleteTarget({ id: detail.id, auditNumber: detail.auditNumber })}
                  >
                    <Trash2 className="size-4" />
                    Sil
                  </Button>

                  {(detail.status === "Completed" || detail.status === "Cancelled") && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={reportGenerating !== null}
                        onClick={() => void generateReport("initial")}
                      >
                        {reportGenerating === "initial" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                        Initial Report
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={reportGenerating !== null}
                        onClick={() => void generateReport("full")}
                      >
                        {reportGenerating === "full" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="size-4" />
                        )}
                        Full Report
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800"
                        onClick={() => setReopenDialogOpen(true)}
                      >
                        <RotateCcw className="size-4" />
                        Reopen
                      </Button>
                    </>
                  )}
                </div>

                {detail.cancellationReason && (
                  <div
                    className={cn(
                      "space-y-1.5 rounded-lg border p-4",
                      detail.status === "Cancelled"
                        ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                        : "bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium",
                        detail.status === "Cancelled" ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
                      )}
                    >
                      <Ban className="size-4 shrink-0" />
                      {detail.status === "Cancelled" ? "Bu denetim iptal edildi" : "Önceki iptal nedeni"}
                    </div>
                    <p className="text-foreground text-sm whitespace-pre-wrap">{detail.cancellationReason}</p>
                  </div>
                )}

                <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                      <ClipboardList className="size-4 shrink-0" />
                      Atanan checklist
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAssignOpen(true)}
                      >
                        Checklist ekle
                      </Button>
                      <Link
                        href="/compliance/checklists"
                        className="text-foreground text-xs underline underline-offset-2 hover:no-underline"
                      >
                        Şablonlar
                      </Link>
                    </div>
                  </div>
                  {(detail.assignedChecklists ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Bu kayıt için henüz checklist atanmadı.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(detail.assignedChecklists ?? []).map((ac) => (
                        <li
                          key={ac.checklistId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">{ac.title}</span>
                            <span className="text-muted-foreground ml-1">
                              {ac.checklistNumber} · REV {ac.revision} · {ac.itemCount} madde
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => void handleUnassignChecklist(ac.checklistId)}
                          >
                            Kaldır
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4 shrink-0" />
                    Denetçiler
                  </div>
                  <p className="text-foreground text-sm">
                    {detail.auditors.length > 0
                      ? detail.auditors.map((a) => a.name).join(", ")
                      : "—"}
                  </p>
                </div>

                <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4 shrink-0" />
                    Denetlenenler
                  </div>
                  <p className="text-foreground text-sm">
                    {detail.auditees.length > 0
                      ? detail.auditees.map((a) => a.name).join(", ")
                      : "- Henüz atanmadı!"}
                  </p>
                </div>

                <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0" />
                      Bulgu / notlar
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={openFindingDialog}
                    >
                      <Plus className="size-3.5" />
                      Bulgu Ekle
                    </Button>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {detail.remarks?.trim()
                      ? detail.remarks.trim()
                      : "- Bulgu bilgisi yok"}
                  </p>

                  {findingsLoading ? (
                    <p className="text-muted-foreground text-sm">Yükleniyor…</p>
                  ) : findings.length > 0 ? (
                    <ul className="space-y-1.5 pt-1">
                      {findings
                        .filter((f): f is AuditPlanFindingRow => !!f && f.id != null)
                        .map((f) => {
                          // SACA/SAFA bulgularında findingLevel null'dur — Level rozeti gösterilmez.
                          const lvl = f.findingLevel ? (findingLevelStyles[f.findingLevel] ?? findingLevelStyles.Level1) : null
                          return (
                            <li key={f.id}>
                              <Link
                                href={`/compliance/findings-follow-up/${f.id}`}
                                className="hover:bg-background flex flex-wrap items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm transition-colors"
                              >
                                <span className="font-mono text-xs font-semibold">{f.findingCode}</span>
                                {lvl && (
                                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[11px] font-medium", lvl.cls)}>
                                    {lvl.label}
                                  </span>
                                )}
                                {f.findingCategory && (
                                  <span
                                    className={cn(
                                      "rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
                                      findingCategoryStyles[f.findingCategory as keyof typeof findingCategoryStyles] ??
                                        findingCategoryStyles.CAT1
                                    )}
                                  >
                                    {findingCategoryLabels[f.findingCategory as keyof typeof findingCategoryLabels] ?? f.findingCategory}
                                  </span>
                                )}
                                <span className="text-muted-foreground min-w-0 flex-1 truncate">{f.explanation}</span>
                                {f.assignedTo?.name && (
                                  <span className="text-muted-foreground text-xs shrink-0">{f.assignedTo.name}</span>
                                )}
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                                    f.status === "Closed"
                                      ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                  )}
                                >
                                  {f.status === "Closed" ? "Kapalı" : "Açık"}
                                </span>
                              </Link>
                            </li>
                          )
                        })}
                    </ul>
                  ) : null}
                </div>

                <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0" />
                      Dosyalar ({documents.length})
                    </span>
                    <label
                      htmlFor={`audit-doc-upload-${uid}`}
                      className={cn(
                        "border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium shadow-xs",
                        documentsUploading && "pointer-events-none opacity-60"
                      )}
                    >
                      <Plus className="size-3.5" />
                      {documentsUploading ? "Yükleniyor…" : "Dosya Ekle"}
                    </label>
                    <input
                      id={`audit-doc-upload-${uid}`}
                      type="file"
                      multiple
                      accept="application/pdf,.pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      className="hidden"
                      disabled={documentsUploading}
                      onChange={(e) => {
                        if (e.target.files?.length) void handleAddDocuments(e.target.files)
                        e.target.value = ""
                      }}
                    />
                  </div>

                  {documentsLoading ? (
                    <p className="text-muted-foreground text-sm">Yükleniyor…</p>
                  ) : documents.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Henüz dosya eklenmedi.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {documents
                        .filter((doc): doc is AuditPlanDocumentRow => !!doc && doc.id != null)
                        .map((doc) => (
                        <li
                          key={doc.id}
                          className="bg-background/60 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <a
                              href={`/api/audit-plan/${detail.id}/documents/${doc.id}/file`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                            >
                              <Download className="size-3.5 shrink-0" />
                              <span className="max-w-[220px] truncate">{doc.fileName}</span>
                            </a>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {doc.uploadedByName ?? "—"} · {formatDetailDate(doc.createdAt)}
                              {doc.fileSizeBytes ? ` · ${formatBytes(doc.fileSizeBytes)}` : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive size-7 shrink-0"
                            onClick={() => setDeleteDocTarget(doc)}
                            aria-label="Dosyayı sil"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <History className="size-4 shrink-0" />
                    Geçmiş
                  </div>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    {historyLoading ? (
                      <li className="text-sm">Yükleniyor…</li>
                    ) : (
                      historyRows
                        .filter((h): h is AuditPlanHistoryRow => !!h && h.id != null)
                        .map((h) => (
                          <li key={h.id} className="flex gap-2 border-l-2 border-violet-300 pl-3 dark:border-violet-700">
                            {h.eventType === "REOPENED" ? (
                              <RotateCcw className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                            ) : (
                              <Clock className="mt-0.5 size-4 shrink-0" />
                            )}
                            <span>
                              <span className="text-foreground font-mono text-xs">
                                {formatDetailDate(h.createdAt)}
                              </span>
                              {" — "}
                              {historyEventText(h)}
                            </span>
                          </li>
                        ))
                    )}
                    <li className="flex gap-2 border-l-2 border-border pl-3">
                      <Clock className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <span className="text-foreground font-mono text-xs">
                          {formatDetailDate(detail.createdAt)}
                        </span>
                        {" — "}
                        Kayıt oluşturuldu (planlı: {detail.datePlanned})
                      </span>
                    </li>
                    {detail.updatedAt !== detail.createdAt && (
                      <li className="flex gap-2 border-l-2 border-border pl-3">
                        <Clock className="mt-0.5 size-4 shrink-0" />
                        <span>
                          <span className="text-foreground font-mono text-xs">
                            {formatDetailDate(detail.updatedAt)}
                          </span>
                          {" — "}
                          Son güncelleme
                        </span>
                      </li>
                    )}
                    <li className="flex gap-2 border-l-2 border-border pl-3">
                      <span className="text-foreground text-xs">
                        C / T: {detail.ct.trim() || "—"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open)
          if (!open) setPickChecklistId("")
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checklist ata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {assignListLoading ? (
              <p className="text-muted-foreground text-sm">Yükleniyor…</p>
            ) : availableChecklistsForAssign.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Eklenecek aktif checklist yok (hepsi atanmış veya Compliance → Checklists
                üzerinde şablon tanımlı değil).
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`assign-cl-${uid}`}>Checklist şablonu</Label>
                <Select value={pickChecklistId} onValueChange={setPickChecklistId}>
                  <SelectTrigger id={`assign-cl-${uid}`} className="w-full">
                    <SelectValue placeholder="Seçin…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChecklistsForAssign.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.checklistNumber ?? `#${t.id}`} — {t.title} (REV{" "}
                        {t.latestRevisionNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={
                assignSubmitting ||
                !pickChecklistId ||
                availableChecklistsForAssign.length === 0
              }
              onClick={() => void handleAssignChecklistSubmit()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {assignSubmitting ? "Atanıyor…" : "Ata"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Postpone Audit ───────────────────────────────────────────────────────── */}
      <PostponeAuditDialog
        open={!!postponeTargetId}
        onOpenChange={(o) => !o && setPostponeTargetId(null)}
        plannedDate={postponeTargetRow?.datePlanned ?? ""}
        initialPostponedDate={postponeTargetRow?.datePostponed}
        loading={postponing}
        onConfirm={confirmPostponeRow}
      />

      {/* ── Cancelled onayı (iptal nedeni zorunlu) ─────────────────────────── */}
      <Dialog open={!!cancelTargetId} onOpenChange={(o) => !cancelling && !o && setCancelTargetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-4 text-red-600" />
              Denetimi iptal et
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="cancel-reason">Cancellation Reason / İptal Nedeni *</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="İptal nedenini açıklayın…"
              className="min-h-[90px]"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCancelTargetId(null)} disabled={cancelling}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling || !cancelReason.trim()}
              onClick={() => void confirmCancel()}
            >
              {cancelling ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />İptal ediliyor…</>
              ) : (
                <><Ban className="mr-1.5 size-4" />Denetimi İptal Et</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reopen onayı ────────────────────────────────────────────────────── */}
      <Dialog open={reopenDialogOpen} onOpenChange={(o) => !reopening && setReopenDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-violet-600" />
              Denetimi yeniden aç
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu denetimi yeniden açmak istediğinizden emin misiniz?
          </p>
          <p className="text-muted-foreground text-xs">
            Checklist cevapları, bulgular, dosyalar ve denetçi/denetlenen bilgileri korunur.
            Denetim tekrar düzenlenebilir duruma gelir.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setReopenDialogOpen(false)} disabled={reopening}>
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={reopening}
              onClick={() => void confirmReopen()}
            >
              {reopening ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />Açılıyor…</>
              ) : (
                <><RotateCcw className="mr-1.5 size-4" />Yeniden Aç</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleteSubmitting && !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetimi Sil</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteTarget
              ? `“${deleteTarget.auditNumber}” numaralı denetim silinecek. Bu işlem geri alınamaz.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteSubmitting}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={handleConfirmDelete}
            >
              {deleteSubmitting ? "Siliniyor…" : "Denetimi Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulgu Ekle (manuel — mevcut standart Finding sistemini kullanır) ──── */}
      <Dialog open={findingDialogOpen} onOpenChange={(o) => !creatingFinding && setFindingDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Bulgu Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {!isSacaOrSafaAuditCategory(detail?.categoryName) && (
              <div className="space-y-2">
                <Label>Bulgu Seviyesi</Label>
                <Select value={findingLevelInput} onValueChange={setFindingLevelInput}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Level1">Level 1</SelectItem>
                    <SelectItem value="Level2">Level 2</SelectItem>
                    <SelectItem value="Observation">Gözlem (Observation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSacaOrSafaAuditCategory(detail?.categoryName) && (
              <div className="space-y-2">
                <Label>Finding Category *</Label>
                <Select value={findingCategoryInput} onValueChange={setFindingCategoryInput}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINDING_CATEGORY_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>{findingCategoryLabels[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Açıklama / Bulgu *</Label>
              <Textarea
                value={findingExplanation}
                onChange={(e) => setFindingExplanation(e.target.value)}
                placeholder="Bulguyu açıklayın…"
                className="min-h-[90px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Referans (İsteğe Bağlı)</Label>
              <Input
                value={findingReference}
                onChange={(e) => setFindingReference(e.target.value)}
                placeholder="Referans madde / doküman"
              />
            </div>
            <div className="space-y-2">
              <Label>Sorumlu Kişi (İsteğe Bağlı)</Label>
              <EmployeeCombobox
                options={findingAssignees}
                value={findingAssignedToId}
                onChange={setFindingAssignedToId}
                placeholder="Personel seçin…"
              />
            </div>
            {isSacaOrSafaAuditCategory(detail?.categoryName) && (
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <DatePicker value={findingDueDateInput} onChange={setFindingDueDateInput} placeholder="dd.mm.yyyy" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFindingDialogOpen(false)} disabled={creatingFinding}>
              Vazgeç
            </Button>
            <Button type="button" disabled={creatingFinding} onClick={() => void submitFinding()}>
              {creatingFinding ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDocTarget} onOpenChange={(o) => !o && setDeleteDocTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dosya silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteDocTarget ? `“${deleteDocTarget.fileName}” kalıcı olarak silinecek.` : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteDocTarget(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingDoc}
              onClick={confirmDeleteDocument}
            >
              {deletingDoc ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
