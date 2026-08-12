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
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileSpreadsheet,
  FileText,
  History as HistoryIcon,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
import { Checkbox } from "@/components/ui/checkbox"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import {
  FINDING_CATEGORY_VALUES,
  findingCategoryLabels,
  findingCategoryStyles,
  isSacaOrSafaAuditCategory,
} from "@/lib/finding-category"
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

  // ─── Public Audit Response Link — denetlenen tarafa gönderilebilecek, Bonjour
  // hesabı gerektirmeyen güvenli cevap bağlantısı (bkz. lib/audit-response-link.ts) ──
  type ResponseLinkRow = {
    id: number
    token: string
    expiresAt: string | null
    revokedAt: string | null
    createdAt: string
    createdByName: string | null
    isActive: boolean
    isExpired: boolean
  }
  const [responseLinks, setResponseLinks] = React.useState<ResponseLinkRow[]>([])
  const [responseLinksLoading, setResponseLinksLoading] = React.useState(false)
  const [linkActionLoading, setLinkActionLoading] = React.useState(false)
  const [expiryInput, setExpiryInput] = React.useState("")

  const reloadResponseLinks = React.useCallback(async () => {
    setResponseLinksLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/response-link`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setResponseLinks(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setResponseLinksLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void reloadResponseLinks()
  }, [reloadResponseLinks])

  const activeLink = responseLinks.find((l) => l.isActive) ?? null

  const responseLinkUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/audit-response/${token}` : `/audit-response/${token}`

  const createResponseLink = async () => {
    setLinkActionLoading(true)
    try {
      const expiresAt = expiryInput ? (parseDdMmYyyyToUtcDate(expiryInput)?.toISOString() ?? null) : null
      const res = await fetch(`/api/audit-plan/${entryId}/response-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bağlantı oluşturulamadı.")
      toast.success("Response link oluşturuldu.")
      setExpiryInput("")
      await Promise.all([reloadResponseLinks(), reloadHistory()])
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(responseLinkUrl(data.token)).catch(() => {})
        toast.success("Bağlantı panoya kopyalandı.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlantı oluşturulamadı.")
    } finally {
      setLinkActionLoading(false)
    }
  }

  const copyResponseLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(responseLinkUrl(token))
      toast.success("Bağlantı panoya kopyalandı.")
    } catch {
      toast.error("Kopyalanamadı.")
    }
  }

  const linkAction = async (linkId: number, action: "revoke" | "reactivate") => {
    setLinkActionLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/response-link/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.")
      toast.success(action === "revoke" ? "Bağlantı devre dışı bırakıldı." : "Bağlantı yeniden etkinleştirildi.")
      await Promise.all([reloadResponseLinks(), reloadHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız.")
    } finally {
      setLinkActionLoading(false)
    }
  }

  // ─── Auditee Notes — Public Audit Response Link (veya kendi hesabı) üzerinden
  // gönderilen notlar, salt okunur; yalnızca yetkili kullanıcı silebilir ──────────
  type ResponseNoteRow = {
    id: number
    note: string
    submitterName: string | null
    submitterEmail: string | null
    submittedAt: string
    viaLink: boolean
  }
  const [auditeeNotes, setAuditeeNotes] = React.useState<ResponseNoteRow[]>([])
  const [auditeeNotesLoading, setAuditeeNotesLoading] = React.useState(false)
  const [deleteNoteTarget, setDeleteNoteTarget] = React.useState<ResponseNoteRow | null>(null)
  const [deletingNote, setDeletingNote] = React.useState(false)

  const reloadAuditeeNotes = React.useCallback(async () => {
    setAuditeeNotesLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/response-notes`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setAuditeeNotes(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setAuditeeNotesLoading(false)
    }
  }, [entryId])

  React.useEffect(() => {
    void reloadAuditeeNotes()
  }, [reloadAuditeeNotes])

  const confirmDeleteNote = async () => {
    if (!deleteNoteTarget) return
    setDeletingNote(true)
    try {
      const res = await fetch(`/api/audit-plan/${entryId}/response-notes/${deleteNoteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Not silindi.")
      setDeleteNoteTarget(null)
      await Promise.all([reloadAuditeeNotes(), reloadHistory()])
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeletingNote(false)
    }
  }

  // ─── Findings (mevcut standart Finding sistemi — aynen kullanılır) ─────────
  const [findings, setFindings] = React.useState<AuditPlanFindingRow[]>([])
  const [findingsLoading, setFindingsLoading] = React.useState(false)
  const [findingDialogOpen, setFindingDialogOpen] = React.useState(false)
  const [findingLevelInput, setFindingLevelInput] = React.useState("Level1")
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde gösterilir/gönderilir. */
  const [findingCategoryInput, setFindingCategoryInput] = React.useState("CAT1")
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
    setFindingCategoryInput("CAT1")
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
          // Sunucu SACA/SAFA dışındaki audit type'larda bu değeri zaten null'a zorlar.
          findingCategory: isSacaOrSafaAuditCategory(detail?.categoryName) ? findingCategoryInput : null,
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Audit could not be completed. Please try again or contact the system administrator."
        )
        return
      }
      toast.success(status === "Completed" ? "Audit successfully completed." : `Durum: ${status}`)
      // Completed olduğunda sunucu aktif response link'leri otomatik iptal eder —
      // paneli güncel göstermek için burada da yeniden yükle.
      await Promise.all([silentRefetch(), reloadHistory(), reloadResponseLinks()])
    } catch {
      toast.error("Audit could not be completed. Please try again or contact the system administrator.")
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
  const [auditeeDepartments, setAuditeeDepartments] = React.useState<string[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>([])
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
    setAuditeeDepartments(detail.auditeeDepartments)
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
    if (!editOpen) return
    ;(async () => {
      try {
        const res = await fetch("/api/audit-plan/departments", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as string[]
        setDepartmentOptions(Array.isArray(data) ? data : [])
      } catch {
        setDepartmentOptions([])
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
          auditeeDepartments,
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
                <InfoField
                  label="Auditee / Responsible Persons"
                  value={
                    [
                      ...detail.auditees.map((a) => a.name),
                      ...detail.auditeeDepartments.map((d) => `${d} (Group)`),
                    ].join(", ") || "Henüz atanmadı"
                  }
                />
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
                  {documents.filter((d): d is AuditPlanDocumentRow => !!d && d.id != null).map((doc) => {
                    // NULL (eski kayıt) → "auditor" olarak ele alınır, geriye dönük uyumlu.
                    const isAuditee = doc.source === "auditee"
                    return (
                      <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <a href={`/api/audit-plan/${entryId}/documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline" title={doc.fileName}>
                            {doc.fileName}
                          </a>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
                              isAuditee
                                ? "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400"
                                : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {isAuditee ? `Submitted by Auditee${doc.submitterName ? ` (${doc.submitterName})` : ""}` : "Uploaded by Auditor"}
                          </span>
                        </div>
                        <span className="text-muted-foreground shrink-0">{formatBytes(doc.fileSizeBytes ?? 0)}</span>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive size-6 shrink-0" onClick={() => setDeleteDocTarget(doc)} aria-label="Dosyayı sil">
                          <Trash2 className="size-3" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Public Audit Response Link */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4 text-blue-600" />
                Response Link
              </h2>
              {responseLinksLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : activeLink ? (
                <div className="space-y-2">
                  <div className="bg-muted/40 flex items-center gap-2 rounded-md border p-2">
                    <code className="min-w-0 flex-1 truncate text-xs">{responseLinkUrl(activeLink.token)}</code>
                    <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => void copyResponseLink(activeLink.token)} aria-label="Kopyala">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {activeLink.expiresAt ? `Son kullanma: ${formatDetailDate(activeLink.expiresAt)}` : "Süresiz"}
                    {activeLink.createdByName ? ` · ${activeLink.createdByName} tarafından oluşturuldu` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={linkActionLoading} onClick={() => void linkAction(activeLink.id, "revoke")}>
                      <Ban className="mr-1.5 size-3.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">Bu denetim için aktif bir response link yok.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Son kullanma (isteğe bağlı)</Label>
                      <DatePicker value={expiryInput} onChange={setExpiryInput} placeholder="dd.mm.yyyy" />
                    </div>
                    <Button type="button" size="sm" disabled={linkActionLoading} onClick={() => void createResponseLink()}>
                      {linkActionLoading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Link2 className="mr-1.5 size-3.5" />}
                      Create / Copy Response Link
                    </Button>
                  </div>
                </div>
              )}
              {responseLinks.filter((l) => !l.isActive).length > 0 && (
                <div className="space-y-1.5 border-t pt-2">
                  <p className="text-muted-foreground text-xs font-medium">Geçmiş bağlantılar</p>
                  <ul className="space-y-1">
                    {responseLinks.filter((l) => !l.isActive).map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
                        <span className="text-muted-foreground min-w-0 truncate">
                          {l.revokedAt ? `İptal: ${formatDetailDate(l.revokedAt)}` : l.isExpired ? "Süresi doldu" : "—"}
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" disabled={linkActionLoading} onClick={() => void linkAction(l.id, "reactivate")}>
                          <RefreshCw className="mr-1 size-3" />
                          Reactivate
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Auditee Notes — Public Audit Response Link (veya kendi hesabı) üzerinden gönderilen notlar */}
            <section className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4 text-violet-600" />
                Auditee Notes ({auditeeNotes.length})
              </h2>
              {auditeeNotesLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : auditeeNotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">Henüz auditee notu yok.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {auditeeNotes.map((n) => (
                    <li key={n.id} className="bg-background/60 rounded-md border p-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 whitespace-pre-wrap">{n.note}</p>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive size-5 shrink-0" onClick={() => setDeleteNoteTarget(n)} aria-label="Notu sil">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {n.submitterName ?? "—"}
                        {n.submitterEmail ? ` (${n.submitterEmail})` : ""} · {formatDetailDate(n.submittedAt)}
                        {n.viaLink ? " · via Response Link" : ""}
                      </p>
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
              <DepartmentMultiSelect
                id="manage-auditee-departments"
                label="Auditee Group / Department"
                options={departmentOptions}
                selected={auditeeDepartments}
                onChange={setAuditeeDepartments}
              />
              <p className="text-muted-foreground -mt-2 text-xs">
                Bir departman/grup atandığında, o departmandaki yetkili kullanıcılar bu denetimi görüp
                cevap verebilir — bireysel seçim şart değildir, ikisi birlikte de kullanılabilir.
              </p>
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
            {isSacaOrSafaAuditCategory(detail?.categoryName) && (
              <div className="space-y-2">
                <Label>Finding Category</Label>
                <Select value={findingCategoryInput} onValueChange={setFindingCategoryInput}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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

      <Dialog open={!!deleteNoteTarget} onOpenChange={(o) => !o && setDeleteNoteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Not silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Bu auditee notu kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteNoteTarget(null)}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deletingNote} onClick={() => void confirmDeleteNote()}>
              {deletingNote ? "Siliniyor…" : "Sil"}
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

/** Türkçe karakter/case-insensitive karşılaştırma için normalize eder (Ü/Ç/Ö/Ğ/Ş/İ/I dahil). */
function normalizeSearchText(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim()
}

/** Auditee Group/Department çoklu seçimi — EmployeeMultiSelect ile aynı desen, string listesi için. */
export function DepartmentMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
}: {
  id: string
  label: string
  options: string[]
  selected: string[]
  onChange: (names: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const summary = selected.length === 0 ? "Departman/Grup seçin… (isteğe bağlı)" : selected.join(", ")

  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter((x) => x !== name))
    else onChange([...selected, name])
  }

  const filteredOptions = React.useMemo(() => {
    const q = normalizeSearchText(query)
    if (!q) return options
    return options.filter((name) => normalizeSearchText(name).includes(q))
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
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">{summary}</span>
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex flex-col gap-0">
            {options.length > 6 ? (
              <div className="relative border-b px-2 py-1.5">
                <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ara…"
                  className="h-8 border-0 pl-7 shadow-none focus-visible:ring-0"
                  autoFocus
                />
              </div>
            ) : null}
            {/* Native overflow scroll + manuel onWheel: bu bileşen Dialog içinde açıldığında
                Dialog'un scroll-lock'u (react-remove-scroll) global wheel event'ini
                preventDefault ediyor; scrollTop'u elle güncelleyerek fare tekerleği
                kaydırmasını garantiye alıyoruz. */}
            <div
              className="max-h-[min(240px,40vh)] overflow-y-auto overscroll-contain"
              onWheel={(e) => {
                e.currentTarget.scrollTop += e.deltaY
              }}
            >
              <div className="flex flex-col gap-0.5 p-2">
                {options.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-center text-sm">Kayıtlı departman yok.</p>
                ) : filteredOptions.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-center text-sm">Sonuç yok.</p>
                ) : (
                  filteredOptions.map((name) => (
                    <label key={name} className="hover:bg-muted/80 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5">
                      <Checkbox checked={selected.includes(name)} onCheckedChange={() => toggle(name)} />
                      <span className="text-sm leading-none">{name}</span>
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
