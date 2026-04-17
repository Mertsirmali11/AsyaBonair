"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  History,
  List,
  MoreVertical,
  Plus,
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
import type { AuditChecklistListRow } from "@/components/compliance/audit-checklists-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { todayLocalDdMmYyyy } from "@/lib/correspondence-date"
import { cn } from "@/lib/utils"

type CalisanLite = { id: number; isim: string | null; soyisim: string | null }

/** Referans ekrandaki durum rozetleri */
const statusStyles: Record<string, string> = {
  Completed: "bg-teal-600/90 text-white hover:bg-teal-600",
  Cancelled: "bg-slate-600 text-white hover:bg-slate-600",
  Initialized: "bg-emerald-600 text-white hover:bg-emerald-600",
  Postponed: "bg-sky-600 text-white hover:bg-sky-600",
}

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

type AuditPlanDetail = {
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
  auditors: { id: number; name: string }[]
  auditees: { id: number; name: string }[]
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

function normalizeAuditDetail(
  data: AuditPlanDetail & { error?: string }
): AuditPlanDetail {
  return {
    ...data,
    assignedChecklists: data.assignedChecklists ?? [],
  }
}

function formatDetailDate(iso: string): string {
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

function EmployeeMultiSelect({
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
          <ScrollArea className="h-[min(240px,40vh)]">
            <div className="flex flex-col gap-0.5 p-2">
              {options.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                  Çalışan listesi yüklenemedi.
                </p>
              ) : (
                options.map((opt) => (
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
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function AuditPlanClient() {
  const uid = React.useId()
  const [keyword, setKeyword] = React.useState("")
  const [rows, setRows] = React.useState<AuditPlanRow[]>([])
  const [listLoading, setListLoading] = React.useState(true)

  const [detailEntryId, setDetailEntryId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AuditPlanDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
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
      if (!res.ok) return
      const data = (await res.json()) as AuditPlanRow[]
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshRows()
  }, [refreshRows])

  const updateStatus = React.useCallback(async (rowId: string, status: string) => {
    try {
      const res = await fetch(`/api/audit-plan/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOnly: true, status }),
      })
      if (!res.ok) { toast.error("Durum güncellenemedi."); return }
      toast.success(`Durum: ${status}`)
      await refreshRows()
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }, [refreshRows])

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
    if (!detail) return
    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/audit-plan/${detail.id}`, { method: "DELETE" })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof errJson.error === "string" ? errJson.error : "Silinemedi."
        toast.error(msg)
        return
      }
      toast.success("Kayıt silindi.")
      setDeleteConfirmOpen(false)
      setDetailEntryId(null)
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
    if (!q) return rows
    return rows.filter((r) =>
      [
        r.auditNumber,
        r.field,
        r.auditors,
        r.status,
        r.datePlanned,
        r.ct,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [rows, keyword])

  return (
    <>
      <SetWorkspacePageTitle title="Audit Plan" />
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  title="Gelişmiş filtre (yakında)"
                  disabled
                >
                  <Filter className="size-4" />
                </Button>
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

        <div className="bg-card min-h-0 flex-1 overflow-hidden rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 px-2 text-center" />
                  <TableHead className="whitespace-nowrap">Date (Planned)</TableHead>
                  <TableHead className="whitespace-nowrap">Date (Postponed)</TableHead>
                  <TableHead className="whitespace-nowrap">Initialized Date</TableHead>
                  <TableHead className="whitespace-nowrap">Audit Number</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead className="whitespace-nowrap text-center">C / T</TableHead>
                  <TableHead>Auditors</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Status</TableHead>
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
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="w-10 px-1 align-middle">
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
                            <DropdownMenuItem onClick={() => setDetailEntryId(row.id)}>
                              <ClipboardList className="mr-2 size-4" />
                              Detay
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/compliance/audit-plan/${row.id}/session`}>
                                <ClipboardCheck className="mr-2 size-4 text-emerald-600" />
                                Denetime Başla
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {row.status !== "Initialized" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Initialized")}>
                                <Clock className="mr-2 size-4 text-emerald-600" />
                                Initialize
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Postponed" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Postponed")}>
                                <CalendarRange className="mr-2 size-4 text-sky-600" />
                                Postpone
                              </DropdownMenuItem>
                            )}
                            {row.status !== "Completed" && (
                              <DropdownMenuItem onClick={() => void updateStatus(row.id, "Completed")}>
                                <CheckCircle2 className="mr-2 size-4 text-teal-600" />
                                Complete
                              </DropdownMenuItem>
                            )}
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
                      <TableCell className="font-mono text-sm">{row.auditNumber}</TableCell>
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
          </div>
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
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Sil
                  </Button>
                </div>

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
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 shrink-0" />
                    Bulgu / notlar
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {detail.remarks?.trim()
                      ? detail.remarks.trim()
                      : "- Bulgu bilgisi yok"}
                  </p>
                </div>

                <div className="bg-muted/40 space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0" />
                      Dosyalar (0)
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">Henüz dosya eklenmedi.</p>
                </div>

                <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <History className="size-4 shrink-0" />
                    Geçmiş
                  </div>
                  <ul className="text-muted-foreground space-y-2 text-sm">
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetim kaydını sil?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {detail
              ? `“${detail.auditNumber}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
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
              {deleteSubmitting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
