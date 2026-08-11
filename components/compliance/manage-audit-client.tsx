"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  History as HistoryIcon,
  Loader2,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { AuditCategoryCombobox } from "@/components/compliance/audit-category-combobox"
import { EmployeeCombobox } from "@/components/employee-combobox"
import type { AuditChecklistListRow } from "@/components/compliance/audit-checklists-client"
import {
  type AuditPlanDetail,
  type AuditPlanDocumentRow,
  type AuditPlanFindingRow,
  type AuditPlanHistoryRow,
  EmployeeMultiSelect,
  findingLevelStyles,
  formatBytes,
  formatDetailDate,
  historyEventText,
  normalizeAuditDetail,
  statusStyles,
} from "@/components/compliance/audit-plan-client"
import { uploadAuditPlanDocumentsDirect } from "@/lib/client-audit-plan-document-upload"
import {
  downloadFullReportPdf,
  downloadInitialReportPdf,
  type AuditPlanReportData,
} from "@/lib/audit-plan-report-download"
import { cn } from "@/lib/utils"

type CalisanLite = { id: number; isim: string | null; soyisim: string | null }

/**
 * Manage Audit / Denetimi Yönet — bir denetimin tüm işlemlerinin tek bir yerden
 * gerçekleştirilebildiği merkezi sayfa. Yeni ve paralel bir Audit/Checklist/Finding
 * sistemi kurmaz; tamamı mevcut /api/audit-plan/[id]/* uç noktalarını (documents,
 * findings, history, reopen, cancel, report, checklists) ve mevcut Finding/Checklist
 * modellerini kullanır.
 */
export function ManageAuditClient({ entryId }: { entryId: number }) {
  const router = useRouter()

  // ─── Detay ────────────────────────────────────────────────────────────────
  const [detail, setDetail] = React.useState<AuditPlanDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

  const loadDetail = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/audit-plan/${entryId}`, { cache: "no-store" })
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      const data = (await res.json()) as AuditPlanDetail & { error?: string }
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Denetim yüklenemedi.")
        return
      }
      setDetail(normalizeAuditDetail(data))
    } catch {
      toast.error("Denetim yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const silentRefetch = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/audit-plan/${entryId}`, { cache: "no-store" })
      const data = (await res.json()) as AuditPlanDetail & { error?: string }
      if (res.ok) setDetail(normalizeAuditDetail(data))
    } catch {
      /* ignore */
    }
  }, [entryId])

  // ─── Audit Files (Denetim Planı'ndan bağımsız — doğrudan Audit ID'ye bağlı) ──
  const [documents, setDocuments] = React.useState<AuditPlanDocumentRow[]>([])
  const [documentsLoading, setDocumentsLoading] = React.useState(false)
  const [documentsUploading, setDocumentsUploading] = React.useState(false)
  const [deleteDocTarget, setDeleteDocTarget] = React.useState<AuditPlanDocumentRow | null>(null)
  const [deletingDoc, setDeletingDoc] = React.useState(false)

  const reloadDocuments = React.useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/documents`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setDocuments(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setDocumentsLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void reloadDocuments()
  }, [reloadDocuments])

  const handleAddDocuments = async (fileList: FileList) => {
    if (fileList.length === 0) return
    setDocumentsUploading(true)
    try {
      const files = Array.from(fileList)
      const uploaded = await uploadAuditPlanDocumentsDirect(String(entryId), files)
      const res = await fetch(`/api/audit-plan/${entryId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Dosya kaydedilemedi.")
      toast.success(`${uploaded.length} dosya eklendi.`)
      await Promise.all([reloadDocuments(), reloadHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dosya yüklenemedi.")
    } finally {
      setDocumentsUploading(false)
    }
  }

  const confirmDeleteDocument = async () => {
    if (!deleteDocTarget) return
    setDeletingDoc(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/documents/${deleteDocTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Dosya silindi.")
      setDeleteDocTarget(null)
      await Promise.all([reloadDocuments(), reloadHistory()])
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeletingDoc(false)
    }
  }

  // ─── Findings (mevcut standart Finding sistemi — aynen kullanılır) ─────────
  const [findings, setFindings] = React.useState<AuditPlanFindingRow[]>([])
  const [findingsLoading, setFindingsLoading] = React.useState(false)
  const [findingDialogOpen, setFindingDialogOpen] = React.useState(false)
  const [findingLevelInput, setFindingLevelInput] = React.useState("Level1")
  const [findingExplanation, setFindingExplanation] = React.useState("")
  const [findingReference, setFindingReference] = React.useState("")
  const [findingAssignedToId, setFindingAssignedToId] = React.useState<number | undefined>(undefined)
  const [findingAssignees, setFindingAssignees] = React.useState<{ id: number; label: string }[]>([])
  const [creatingFinding, setCreatingFinding] = React.useState(false)

  const reloadFindings = React.useCallback(async () => {
    setFindingsLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/findings`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setFindings(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setFindingsLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void reloadFindings()
  }, [reloadFindings])

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
          data.map((c) => ({ id: c.id, label: [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || `ID ${c.id}` }))
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
    setFindingExplanation("")
    setFindingReference("")
    setFindingAssignedToId(undefined)
    setFindingDialogOpen(true)
  }

  const submitFinding = async () => {
    if (!findingExplanation.trim()) {
      toast.error("Açıklama zorunludur.")
      return
    }
    setCreatingFinding(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingLevel: findingLevelInput,
          explanation: findingExplanation.trim(),
          reference: findingReference.trim() || null,
          assignedToId: findingAssignedToId ?? null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bulgu kaydedilemedi.")
      toast.success(`Bulgu eklendi (${data.findingCode ?? ""}).`)
      setFindingDialogOpen(false)
      await Promise.all([reloadFindings(), reloadHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulgu kaydedilemedi.")
    } finally {
      setCreatingFinding(false)
    }
  }

  // ─── Audit History ──────────────────────────────────────────────────────────
  const [historyRows, setHistoryRows] = React.useState<AuditPlanHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)

  const reloadHistory = React.useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/history`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setHistoryRows(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setHistoryLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  // ─── Assigned Checklist & Revision ──────────────────────────────────────────
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [checklistTemplates, setChecklistTemplates] = React.useState<AuditChecklistListRow[]>([])
  const [assignListLoading, setAssignListLoading] = React.useState(false)
  const [pickChecklistId, setPickChecklistId] = React.useState<string>("")
  const [assignSubmitting, setAssignSubmitting] = React.useState(false)

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

  const availableChecklistsForAssign = React.useMemo(() => {
    const assigned = new Set(detail?.assignedChecklists?.map((c) => c.checklistId) ?? [])
    return checklistTemplates.filter((t) => t.isActive && !assigned.has(t.id))
  }, [checklistTemplates, detail?.assignedChecklists])

  const handleUnassignChecklist = async (checklistId: number) => {
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/checklists/${checklistId}`, { method: "DELETE" })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof errJson.error === "string" ? errJson.error : "Kaldırılamadı.")
        return
      }
      toast.success("Checklist kaldırıldı.")
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }

  const handleAssignChecklistSubmit = async () => {
    if (!pickChecklistId) {
      toast.error("Checklist seçin.")
      return
    }
    const auditChecklistId = Number(pickChecklistId)
    if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1) return
    setAssignSubmitting(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditChecklistId }),
      })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof errJson.error === "string" ? errJson.error : "Atanamadı.")
        return
      }
      toast.success("Checklist atandı.")
      setAssignOpen(false)
      setPickChecklistId("")
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setAssignSubmitting(false)
    }
  }

  // ─── Initialized Date (manuel, yetkili kullanıcı tarafından değiştirilebilir) ──
  const [initDateInput, setInitDateInput] = React.useState("")
  const [savingInitDate, setSavingInitDate] = React.useState(false)

  React.useEffect(() => {
    if (detail) setInitDateInput(detail.initializedDate ?? "")
  }, [detail])

  const saveInitializedDate = async () => {
    setSavingInitDate(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initializedDateOnly: true, initializedDate: initDateInput || "" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.")
      toast.success("Initialized Date güncellendi.")
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi.")
    } finally {
      setSavingInitDate(false)
    }
  }

  // ─── Status hızlı işlemleri ─────────────────────────────────────────────────
  const [changingStatus, setChangingStatus] = React.useState(false)

  const updateStatus = async (status: string) => {
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOnly: true, status }),
      })
      if (!res.ok) {
        toast.error("Durum güncellenemedi.")
        return
      }
      toast.success(`Durum: ${status}`)
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setChangingStatus(false)
    }
  }

  // ─── Cancelled ─────────────────────────────────────────────────────────────
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState("")
  const [cancelling, setCancelling] = React.useState(false)

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("İptal nedeni zorunludur.")
      return
    }
    setCancelling(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Denetim iptal edilemedi.")
      toast.success("Denetim iptal edildi.")
      setCancelDialogOpen(false)
      setCancelReason("")
      await Promise.all([silentRefetch(), reloadHistory()])
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
    setReopening(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/reopen`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Denetim yeniden açılamadı.")
      toast.success("Denetim yeniden açıldı.")
      setReopenDialogOpen(false)
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Denetim yeniden açılamadı.")
    } finally {
      setReopening(false)
    }
  }

  // ─── Initial Report / Full Report ──────────────────────────────────────────
  const [reportGenerating, setReportGenerating] = React.useState<"initial" | "full" | null>(null)

  const generateReport = async (kind: "initial" | "full") => {
    setReportGenerating(kind)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/report`, { cache: "no-store" })
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

  // ─── General Audit Information — düzenleme dialogu ─────────────────────────
  const [editOpen, setEditOpen] = React.useState(false)
  const [plannedDate, setPlannedDate] = React.useState("")
  const [auditCategoryTypeId, setAuditCategoryTypeId] = React.useState<number | undefined>(undefined)
  const [auditSubCategoryTypeId, setAuditSubCategoryTypeId] = React.useState<number | undefined>(undefined)
  const [categoryOptions, setCategoryOptions] = React.useState<{ id: number; name: string }[]>([])
  const [subCategoryOptions, setSubCategoryOptions] = React.useState<{ id: number; name: string }[]>([])
  const [subCategoriesLoading, setSubCategoriesLoading] = React.useState(false)
  const [auditPrefix, setAuditPrefix] = React.useState("")
  const [auditorIds, setAuditorIds] = React.useState<number[]>([])
  const [auditeeIds, setAuditeeIds] = React.useState<number[]>([])
  const [remarksInput, setRemarksInput] = React.useState("")
  const [employees, setEmployees] = React.useState<{ id: number; label: string }[]>([])
  const [savingEdit, setSavingEdit] = React.useState(false)
  const editSubRestoreRef = React.useRef<number | null>(null)

  const openEditDialog = () => {
    if (!detail) return
    editSubRestoreRef.current = detail.auditSubCategoryTypeId ?? null
    setPlannedDate(detail.datePlanned)
    setAuditCategoryTypeId(detail.auditCategoryTypeId)
    setAuditSubCategoryTypeId(undefined)
    setAuditPrefix(detail.auditNumberPrefix?.trim() ?? "")
    setAuditorIds(detail.auditors.map((a) => a.id))
    setAuditeeIds(detail.auditees.map((a) => a.id))
    setRemarksInput(detail.remarks ?? "")
    setEditOpen(true)
  }

  React.useEffect(() => {
    if (!editOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/audit-category-types", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { id: number; name: string; isActive?: boolean }[]
        if (cancelled) return
        setCategoryOptions((Array.isArray(data) ? data : []).filter((r) => r.isActive !== false).map((r) => ({ id: r.id, name: r.name })))
      } catch {
        if (!cancelled) setCategoryOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editOpen])

  React.useEffect(() => {
    if (!editOpen) return
    ;(async () => {
      try {
        const res = await fetch("/api/calisanlar")
        if (!res.ok) return
        const data = (await res.json()) as CalisanLite[]
        setEmployees(data.map((c) => ({ id: c.id, label: [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || `ID ${c.id}` })))
      } catch {
        setEmployees([])
      }
    })()
  }, [editOpen])

  React.useEffect(() => {
    if (!editOpen || !auditCategoryTypeId) {
      setSubCategoryOptions([])
      return
    }
    let cancelled = false
    setSubCategoriesLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/audit-subcategory-types?categoryTypeId=${auditCategoryTypeId}`, { cache: "no-store" })
        if (!res.ok || cancelled) {
          if (!cancelled) setSubCategoryOptions([])
          return
        }
        const data = (await res.json()) as { id: number; name: string }[]
        if (cancelled) return
        const opts = Array.isArray(data) ? data : []
        setSubCategoryOptions(opts)
        const want = editSubRestoreRef.current
        editSubRestoreRef.current = null
        setAuditSubCategoryTypeId(want !== null && opts.some((s) => s.id === want) ? want : undefined)
      } catch {
        if (!cancelled) setSubCategoryOptions([])
      } finally {
        if (!cancelled) setSubCategoriesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editOpen, auditCategoryTypeId])

  const saveGeneralInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auditCategoryTypeId) {
      toast.error("Kategori seçin.")
      return
    }
    if (subCategoryOptions.length > 0 && !auditSubCategoryTypeId) {
      toast.error("Alt kategori seçin.")
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedDate,
          auditCategoryTypeId,
          ...(auditSubCategoryTypeId ? { auditSubCategoryTypeId } : {}),
          auditNumberPrefix: auditPrefix.trim() || undefined,
          remarks: remarksInput.trim() || undefined,
          auditorIds,
          auditeeIds,
        }),
      })
      const errJson = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof errJson.error === "string" ? errJson.error : "Güncellenemedi.")
      toast.success("Denetim güncellendi.")
      setEditOpen(false)
      await Promise.all([silentRefetch(), reloadHistory()])
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Güncellenemedi.")
    } finally {
      setSavingEdit(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  const closedLike = detail?.status === "Completed" || detail?.status === "Cancelled"

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10">
        <p className="text-muted-foreground">Denetim bulunamadı.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/compliance/audit-plan"><ArrowLeft className="mr-1.5 size-4" />Audit Plan&apos;a dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={`Manage Audit — ${detail.auditNumber}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 md:p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/audit-plan">Audit Plan</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Manage Audit</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => {
                // router.back() (browser geçmişi) kullanılır — Audit Plan listesine
                // push ile yeniden gitmek filtre/sıralama/arama/sayfa konumunu sıfırlar,
                // back() Next.js router cache'i sayesinde bunları korur.
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back()
                } else {
                  router.push("/compliance/audit-plan")
                }
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {detail.auditNumber}
                <span className={cn("rounded px-2 py-0.5 text-xs font-medium", statusStyles[detail.status] ?? "bg-slate-500 text-white")}>
                  {detail.status}
                </span>
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">{detail.field}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}>
              <Settings className="size-4" />
              Edit
            </Button>
            {detail.status !== "Cancelled" && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-800" onClick={() => setCancelDialogOpen(true)}>
                <Ban className="size-4" />
                Cancelled
              </Button>
            )}
            {closedLike && (
              <>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={reportGenerating !== null} onClick={() => void generateReport("initial")}>
                  {reportGenerating === "initial" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  Initial Report
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={reportGenerating !== null} onClick={() => void generateReport("full")}>
                  {reportGenerating === "full" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                  Full Report
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800" onClick={() => setReopenDialogOpen(true)}>
                  <RotateCcw className="size-4" />
                  Reopen
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cancellation banner */}
        {detail.cancellationReason && (
          <div className={cn(
            "flex items-start gap-2 rounded-lg border p-4 text-sm",
            detail.status === "Cancelled" ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300" : "bg-muted/40 text-muted-foreground"
          )}>
            <Ban className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">{detail.status === "Cancelled" ? "Bu denetim iptal edildi." : "Önceki iptal nedeni:"}</span>{" "}
              {detail.cancellationReason}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Left column: General Info + Checklist + Findings + Remarks */}
          <div className="flex flex-col gap-5 xl:col-span-2">

            {/* General Audit Information */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4 text-blue-600" />
                General Audit Information
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoField label="Audit Number" value={detail.auditNumber} />
                <InfoField label="Audit Type / Category" value={detail.subCategoryName ? `${detail.categoryName} — ${detail.subCategoryName}` : detail.categoryName} />
                <InfoField label="Field / Department" value={detail.field} />
                <InfoField label="Planned Date" value={detail.datePlanned} />
                <InfoField label="Postponed Date" value={detail.datePostponed ?? "—"} />
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">Initialized Date</p>
                  <div className="flex items-center gap-2">
                    <DatePicker value={initDateInput} onChange={setInitDateInput} placeholder="dd.mm.yyyy" />
                    <Button type="button" size="sm" variant="outline" disabled={savingInitDate || initDateInput === (detail.initializedDate ?? "")} onClick={() => void saveInitializedDate()}>
                      {savingInitDate ? <Loader2 className="size-3.5 animate-spin" /> : "Kaydet"}
                    </Button>
                  </div>
                </div>
                <InfoField label="Lead Auditor" value={detail.auditors[0]?.name ?? "—"} />
                <InfoField label="Audit Team / Auditors" value={detail.auditors.length > 0 ? detail.auditors.map((a) => a.name).join(", ") : "—"} />
                <InfoField label="Auditee / Responsible Persons" value={detail.auditees.length > 0 ? detail.auditees.map((a) => a.name).join(", ") : "Henüz atanmadı"} />
                <InfoField label="Current Status" value={detail.status} />
              </div>
            </section>

            {/* Assigned Checklist & Revision */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardCheck className="size-4 text-emerald-600" />
                  Assigned Checklist & Revision
                </h2>
                <Button type="button" variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                  <Plus className="mr-1.5 size-3.5" />
                  Assign Checklist
                </Button>
              </div>
              {(detail.assignedChecklists ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No checklist assigned</p>
              ) : (
                <ul className="space-y-2">
                  {detail.assignedChecklists.map((ac) => (
                    <li key={ac.checklistId} className="bg-background/60 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                      <Link href={`/compliance/audit-plan/${entryId}/session`} className="min-w-0 flex-1 hover:underline">
                        <span className="font-medium">{ac.title}</span>
                        <span className="text-muted-foreground ml-1">
                          {ac.checklistNumber} · Revision {ac.revision} · {ac.itemCount} items
                        </span>
                      </Link>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => void handleUnassignChecklist(ac.checklistId)}>
                        <Trash2 className="mr-1 size-3.5" />
                        Kaldır
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Findings */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="size-4 text-red-500" />
                  Findings ({findings.length})
                </h2>
                <Button type="button" variant="outline" size="sm" onClick={openFindingDialog}>
                  <Plus className="mr-1.5 size-3.5" />
                  Add Finding
                </Button>
              </div>
              {findingsLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : findings.length === 0 ? (
                <p className="text-muted-foreground text-sm">Bu denetime bağlı bulgu yok.</p>
              ) : (
                <ul className="space-y-1.5">
                  {findings.filter((f): f is AuditPlanFindingRow => !!f && f.id != null).map((f) => {
                    const lvl = findingLevelStyles[f.findingLevel] ?? findingLevelStyles.Level1
                    return (
                      <li key={f.id}>
                        <Link href={`/compliance/findings-follow-up/${f.id}`} className="bg-background/60 hover:bg-background flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors">
                          <span className="font-mono text-xs font-semibold">{f.findingCode}</span>
                          <span className={cn("rounded-full border px-1.5 py-0.5 text-[11px] font-medium", lvl.cls)}>{lvl.label}</span>
                          <span className="text-muted-foreground min-w-0 flex-1 truncate">{f.explanation}</span>
                          {f.assignedTo?.name && <span className="text-muted-foreground shrink-0 text-xs">{f.assignedTo.name}</span>}
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium", f.status === "Closed" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400")}>
                            {f.status === "Closed" ? "Kapalı" : "Açık"}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Audit Remarks */}
            <section className="bg-card space-y-2 rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-muted-foreground" />
                  Audit Remarks
                </h2>
                <Button type="button" variant="ghost" size="sm" onClick={openEditDialog}>Düzenle</Button>
              </div>
              <p className="text-foreground text-sm whitespace-pre-wrap">
                {detail.remarks?.trim() ? detail.remarks.trim() : "Henüz not girilmedi."}
              </p>
            </section>
          </div>

          {/* Right column: Files + Status + History */}
          <div className="flex flex-col gap-5">
            {/* Audit Files */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-muted-foreground" />
                  Audit Files ({documents.length})
                </h2>
                <label
                  htmlFor="manage-audit-file-upload"
                  className={cn(
                    "border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium shadow-xs",
                    documentsUploading && "pointer-events-none opacity-60"
                  )}
                >
                  <Plus className="size-3.5" />
                  {documentsUploading ? "Yükleniyor…" : "Add File"}
                </label>
                <input
                  id="manage-audit-file-upload"
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
                  {documents.filter((d): d is AuditPlanDocumentRow => !!d && d.id != null).map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                      <a href={`/api/audit-plan/${entryId}/documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" title={doc.fileName}>
                        {doc.fileName}
                      </a>
                      <span className="text-muted-foreground shrink-0">{formatBytes(doc.fileSizeBytes ?? 0)}</span>
                      <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive size-6 shrink-0" onClick={() => setDeleteDocTarget(doc)} aria-label="Dosyayı sil">
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Status management */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                Audit Status
              </h2>
              <div className="flex flex-wrap gap-2">
                {["Planned", "Initialized", "Postponed", "Completed"].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={detail.status === s ? "default" : "outline"}
                    disabled={changingStatus || detail.status === s}
                    onClick={() => void updateStatus(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </section>

            {/* Audit History */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <HistoryIcon className="size-4 text-muted-foreground" />
                Audit History
              </h2>
              <ul className="text-muted-foreground max-h-[420px] space-y-2 overflow-y-auto text-sm">
                {historyLoading ? (
                  <li>Yükleniyor…</li>
                ) : (
                  <>
                    {historyRows.filter((h): h is AuditPlanHistoryRow => !!h && h.id != null).map((h) => (
                      <li key={h.id} className="border-border flex gap-2 border-l-2 pl-3">
                        <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          <span className="text-foreground font-mono text-xs">{formatDetailDate(h.createdAt)}</span>
                          {" — "}
                          {historyEventText(h)}
                        </span>
                      </li>
                    ))}
                    <li className="border-border flex gap-2 border-l-2 pl-3">
                      <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <span className="text-foreground font-mono text-xs">{formatDetailDate(detail.createdAt)}</span>
                        {" — "}
                        Audit Created (planlı: {detail.datePlanned})
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {/* ── Edit General Info Dialog ─────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(o) => !savingEdit && setEditOpen(o)}>
        <DialogContent className="!flex max-h-[min(90dvh,90vh)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pt-6 pr-14 text-left">
            <DialogTitle>Edit General Audit Information</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveGeneralInfo} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                <Label>Planned Date</Label>
                <DatePicker value={plannedDate} onChange={setPlannedDate} />
              </div>
              <div className="space-y-2">
                <Label>Audit Type / Category</Label>
                <AuditCategoryCombobox options={categoryOptions} value={auditCategoryTypeId} onChange={setAuditCategoryTypeId} placeholder="Kategori seçin…" />
              </div>
              {subCategoryOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Sub-category</Label>
                  <AuditCategoryCombobox
                    options={subCategoryOptions}
                    value={auditSubCategoryTypeId}
                    onChange={setAuditSubCategoryTypeId}
                    placeholder={subCategoriesLoading ? "Yükleniyor…" : "Alt kategori seçin…"}
                    disabled={subCategoriesLoading}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Audit Number Prefix</Label>
                <Input value={auditPrefix} onChange={(e) => setAuditPrefix(e.target.value)} placeholder="Write a prefix" />
              </div>
              <EmployeeMultiSelect id="manage-auditors" label="Audit Team / Auditors" options={employees} selectedIds={auditorIds} onChange={setAuditorIds} />
              <EmployeeMultiSelect id="manage-auditees" label="Auditee / Responsible Persons" options={employees} selectedIds={auditeeIds} onChange={setAuditeeIds} />
              <div className="space-y-2">
                <Label>Audit Remarks</Label>
                <Textarea value={remarksInput} onChange={(e) => setRemarksInput(e.target.value)} className="min-h-[88px] resize-y" />
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>Vazgeç</Button>
              <Button type="submit" disabled={savingEdit}>{savingEdit ? "Kaydediliyor…" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Checklist Dialog ──────────────────────────────────────────── */}
      <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setPickChecklistId("") }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {assignListLoading ? (
              <p className="text-muted-foreground text-sm">Yükleniyor…</p>
            ) : availableChecklistsForAssign.length === 0 ? (
              <p className="text-muted-foreground text-sm">Atanabilecek aktif checklist yok.</p>
            ) : (
              <Select value={pickChecklistId} onValueChange={setPickChecklistId}>
                <SelectTrigger><SelectValue placeholder="Checklist seçin…" /></SelectTrigger>
                <SelectContent>
                  {availableChecklistsForAssign.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.title} {t.checklistNumber ? `(${t.checklistNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Vazgeç</Button>
            <Button type="button" disabled={assignSubmitting || availableChecklistsForAssign.length === 0} onClick={() => void handleAssignChecklistSubmit()}>
              {assignSubmitting ? "Atanıyor…" : "Ata"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Finding Dialog ───────────────────────────────────────────────── */}
      <Dialog open={findingDialogOpen} onOpenChange={(o) => !creatingFinding && setFindingDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Add Finding
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Bulgu Seviyesi</Label>
              <Select value={findingLevelInput} onValueChange={setFindingLevelInput}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Level1">Level 1</SelectItem>
                  <SelectItem value="Level2">Level 2</SelectItem>
                  <SelectItem value="Observation">Gözlem (Observation)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Açıklama / Bulgu *</Label>
              <Textarea value={findingExplanation} onChange={(e) => setFindingExplanation(e.target.value)} placeholder="Bulguyu açıklayın…" className="min-h-[90px]" />
            </div>
            <div className="space-y-2">
              <Label>Referans (İsteğe Bağlı)</Label>
              <Input value={findingReference} onChange={(e) => setFindingReference(e.target.value)} placeholder="Referans madde / doküman" />
            </div>
            <div className="space-y-2">
              <Label>Sorumlu Kişi (İsteğe Bağlı)</Label>
              <EmployeeCombobox options={findingAssignees} value={findingAssignedToId} onChange={setFindingAssignedToId} placeholder="Personel seçin…" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFindingDialogOpen(false)} disabled={creatingFinding}>Vazgeç</Button>
            <Button type="button" disabled={creatingFinding} onClick={() => void submitFinding()}>{creatingFinding ? "Kaydediliyor…" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancelled onayı ──────────────────────────────────────────────────── */}
      <Dialog open={cancelDialogOpen} onOpenChange={(o) => !cancelling && setCancelDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-4 text-red-600" />
              Denetimi iptal et
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="manage-cancel-reason">Cancellation Reason / İptal Nedeni *</Label>
            <Textarea id="manage-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="İptal nedenini açıklayın…" className="min-h-[90px]" autoFocus />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={cancelling || !cancelReason.trim()} onClick={() => void confirmCancel()}>
              {cancelling ? <><Loader2 className="mr-1.5 size-4 animate-spin" />İptal ediliyor…</> : <><Ban className="mr-1.5 size-4" />Denetimi İptal Et</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reopen onayı ─────────────────────────────────────────────────────── */}
      <Dialog open={reopenDialogOpen} onOpenChange={(o) => !reopening && setReopenDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-violet-600" />
              Denetimi yeniden aç
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Bu denetimi yeniden açmak istediğinizden emin misiniz?</p>
          <p className="text-muted-foreground text-xs">Checklist cevapları, bulgular, dosyalar ve denetçi/denetlenen bilgileri korunur.</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setReopenDialogOpen(false)} disabled={reopening}>Vazgeç</Button>
            <Button type="button" className="bg-violet-600 hover:bg-violet-700" disabled={reopening} onClick={() => void confirmReopen()}>
              {reopening ? <><Loader2 className="mr-1.5 size-4 animate-spin" />Açılıyor…</> : <><RotateCcw className="mr-1.5 size-4" />Yeniden Aç</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete File onayı ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteDocTarget} onOpenChange={(o) => !o && setDeleteDocTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dosya silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{deleteDocTarget ? `“${deleteDocTarget.fileName}” kalıcı olarak silinecek.` : ""}</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteDocTarget(null)}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deletingDoc} onClick={() => void confirmDeleteDocument()}>
              {deletingDoc ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground text-sm">{value}</p>
    </div>
  )
}
