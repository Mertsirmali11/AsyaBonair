"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  History as HistoryIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  User,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { uploadAuditFindingFilesDirect } from "@/lib/client-audit-finding-file-upload"
import { findingCategoryLabels, findingCategoryStyles, isSacaOrSafaAuditCategory, FINDING_CATEGORY_VALUES } from "@/lib/finding-category"
import { findingLevelStyles } from "@/components/compliance/audit-plan-client"
import { DatePicker } from "@/components/ui/date-picker"
import { dbDateToDdMmYyyy, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AssigneeCombobox, type AssigneeValue } from "@/components/assignee-combobox"

type Attachment = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedAt: string
}

type Response = {
  id: number
  rootCause: string | null
  correctiveAction: string | null
  preventiveAction: string | null
  /** Pending | RevisionRequested | Resubmitted | Accepted */
  cpaStatus: string
  /** Auditor'ın revizyon gerekçesi (alan adı tarihsel, artık "reject" değil "revision" anlamında) */
  rejectComment: string | null
  reviewedBy: { id: number; isim: string | null; soyisim: string | null } | null
  reviewedAt: string | null
  submittedAt: string
  respondedBy: { id: number; isim: string | null; soyisim: string | null } | null
  attachments: Attachment[]
}

type Extension = {
  id: number
  newDueDate: string
  reason: string | null
  status: string
  isExpired: boolean
  requestedBy: { id: number; isim: string | null; soyisim: string | null } | null
  createdAt: string
}

type FindingDetail = {
  id: number
  findingCode: string
  /** Level1 | Level2 | Observation — SACA/SAFA denetimlerinde null (tek sınıflandırma
   * findingCategory'dir). */
  findingLevel: string | null
  /** CAT1 | CAT2 | CAT3 — yalnızca SACA/SAFA denetimlerinde dolu, diğerlerinde null. */
  findingCategory: string | null
  explanation: string
  reference: string | null
  field: string | null
  auditNumber: string | null
  initializedOn: string
  dueDate: string | null
  status: string
  /** Person/Group karşılıklı dışlayıcı — ikisi birden dolu olamaz. */
  assignedTo: { id: number; isim: string | null; soyisim: string | null; departman: string | null } | null
  assignedGroup: { id: number; name: string; description: string | null } | null
  /** Server-side hesaplanmış — client hiçbir yetki hesabı yapmaz, yalnızca bu iki boolean'a
   * göre form/aksiyonları gösterir/gizler. Gerçek enforcement her zaman ilgili API route'unda. */
  cpaPermissions: { canRespond: boolean; canReview: boolean }
  responses: Response[]
  extensions: Extension[]
  // Checklist üzerinden otomatik oluşan bulgularda dolu (gerçek AuditSession).
  // "Bulgu Ekle" ile Denetim Planı panelinden manuel eklenen bulgularda checklist=null
  // olur ama entry (kategori/denetlenenler) bilgisi sunucu tarafında aynı şekle normalize edilir.
  session: {
    entry: {
      auditCategoryType: { name: string }
      auditSubCategoryType: { name: string } | null
      auditees: { calisan: { id: number; isim: string | null; soyisim: string | null } }[]
      /// Auditee Group/Department — bireysel auditee'ye ek olarak (veya onun yerine) atanmış olabilir.
      auditeeDepartments: { departmentName: string }[]
    }
    checklist: { id: number; title: string; checklistNumber: string | null } | null
  } | null
  sessionItem: {
    checklistItem: { label: string; reference: string | null }
  } | null
}

type CalisanLite = { id: number; isim: string | null; soyisim: string | null }

type FindingFileRow = {
  id: number
  fileName: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedByName: string | null
  createdAt: string
}

type FindingHistoryRow = {
  id: number
  createdAt: string
  eventType: string
  note: string | null
  actorName: string | null
}

function formatFileBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function parseJson(res: Response | globalThis.Response): Promise<unknown> {
  const t = await (res as globalThis.Response).text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return "—" }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "—"
  return [c.isim, c.soyisim].filter(Boolean).join(" ") || "—"
}

/** Pending → RevisionRequested → Resubmitted → Accepted */
const cpaStatusConfig: Record<string, { label: string; cls: string }> = {
  Pending: { label: "İnceleme Bekliyor", cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700" },
  Resubmitted: { label: "Tekrar Gönderildi", cls: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700" },
  RevisionRequested: { label: "Düzenleme İstendi", cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700" },
  Accepted: { label: "Kabul Edildi", cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700" },
}

export function FindingDetailClient({
  findingId,
  currentCalisanId,
  isAdmin = true,
}: {
  findingId: number
  currentCalisanId: number | null
  /** Audit Plan admini mi (compliance_monitoring izni) — atama/CPA review gibi yönetici aksiyonları buna göre gösterilir. */
  isAdmin?: boolean
}) {
  const [finding, setFinding] = React.useState<FindingDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [calisanlar, setCalisanlar] = React.useState<CalisanLite[]>([])
  const [groups, setGroups] = React.useState<{ id: number; label: string; memberCount: number }[]>([])

  // Response form state
  const [responseOpen, setResponseOpen] = React.useState(false)
  const [rootCause, setRootCause] = React.useState("")
  const [correctiveAction, setCorrectiveAction] = React.useState("")
  const [preventiveAction, setPreventiveAction] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Attachment state
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const [createdResponseId, setCreatedResponseId] = React.useState<number | null>(null)

  // Assign user state
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignValue, setAssignValue] = React.useState<AssigneeValue>(null)
  const [assigning, setAssigning] = React.useState(false)

  // Edit Finding state
  const router = useRouter()
  const [editOpen, setEditOpen] = React.useState(false)
  const [editLevel, setEditLevel] = React.useState("Level1")
  const [editCategory, setEditCategory] = React.useState<string>("CAT1")
  const [editExplanation, setEditExplanation] = React.useState("")
  const [editReference, setEditReference] = React.useState("")
  const [editAssignValue, setEditAssignValue] = React.useState<AssigneeValue>(null)
  const [editDueDate, setEditDueDate] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)

  // Delete Finding state
  const [deleteFindingOpen, setDeleteFindingOpen] = React.useState(false)
  const [deletingFinding, setDeletingFinding] = React.useState(false)

  // Revision Request dialog state
  const [revisionRequestOpen, setRevisionRequestOpen] = React.useState(false)
  const [revisionRequestTargetId, setRevisionRequestTargetId] = React.useState<number | null>(null)
  const [revisionRequestNote, setRevisionRequestNote] = React.useState("")
  const [requestingRevision, setRequestingRevision] = React.useState(false)
  const [acceptingResponseId, setAcceptingResponseId] = React.useState<number | null>(null)

  // Finding Files state (checklist eklerinden ve Audit Files'tan bağımsız, doğrudan Finding ID'ye bağlı)
  const [findingFiles, setFindingFiles] = React.useState<FindingFileRow[]>([])
  const [findingFilesLoading, setFindingFilesLoading] = React.useState(false)
  const [findingFilesUploading, setFindingFilesUploading] = React.useState(false)
  const [deleteFileTarget, setDeleteFileTarget] = React.useState<FindingFileRow | null>(null)
  const [deletingFile, setDeletingFile] = React.useState(false)

  // Finding History state (Reminder gönderimi vb.)
  const [findingHistory, setFindingHistory] = React.useState<FindingHistoryRow[]>([])
  const [findingHistoryLoading, setFindingHistoryLoading] = React.useState(false)

  // Send Reminder state
  const [sendingReminder, setSendingReminder] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, { cache: "no-store" })
      const data = await parseJson(res as globalThis.Response)
      if (!res.ok || !data) { toast.error("Bulgu yüklenemedi."); return }
      setFinding(data as FindingDetail)
    } catch {
      toast.error("Yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [findingId])

  const loadFindingFiles = React.useCallback(async () => {
    setFindingFilesLoading(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/files`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setFindingFiles(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setFindingFilesLoading(false)
    }
  }, [findingId])

  const loadFindingHistory = React.useCallback(async () => {
    setFindingHistoryLoading(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/history`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      setFindingHistory(res.ok && Array.isArray(data) ? data : [])
    } finally {
      setFindingHistoryLoading(false)
    }
  }, [findingId])

  const handleAddFindingFiles = async (fileList: FileList) => {
    if (fileList.length === 0) return
    setFindingFilesUploading(true)
    try {
      const files = Array.from(fileList)
      const uploaded = await uploadAuditFindingFilesDirect(findingId, files)
      const res = await fetch(`/api/audit-findings/${findingId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Dosya kaydedilemedi.")
      toast.success(`${uploaded.length} dosya eklendi.`)
      await Promise.all([loadFindingFiles(), loadFindingHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dosya yüklenemedi.")
    } finally {
      setFindingFilesUploading(false)
    }
  }

  const confirmDeleteFindingFile = async () => {
    if (!deleteFileTarget) return
    setDeletingFile(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/files/${deleteFileTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Dosya silindi.")
      setDeleteFileTarget(null)
      await Promise.all([loadFindingFiles(), loadFindingHistory()])
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeletingFile(false)
    }
  }

  const sendReminder = async () => {
    setSendingReminder(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/reminder`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Hatırlatma gönderilemedi.")
      if (data.skipped) {
        toast.error(`Hatırlatma gönderilemedi: ${data.reason ?? "e-posta altyapısı yapılandırılmamış."}`)
      } else {
        toast.success(`Hatırlatma ${data.recipientLabel ?? ""} adresine gönderildi (${data.sent}/${data.recipientCount}).`)
      }
      await loadFindingHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hatırlatma gönderilemedi.")
    } finally {
      setSendingReminder(false)
    }
  }

  const openEditDialog = () => {
    if (!finding) return
    setEditLevel(finding.findingLevel || "Level1")
    setEditCategory(finding.findingCategory || "CAT1")
    setEditExplanation(finding.explanation)
    setEditReference(finding.reference || "")
    setEditAssignValue(
      finding.assignedGroup
        ? { type: "group", id: finding.assignedGroup.id }
        : finding.assignedTo
          ? { type: "person", id: finding.assignedTo.id }
          : null
    )
    setEditDueDate(finding.dueDate ? dbDateToDdMmYyyy(finding.dueDate) : "")
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!finding) return
    if (!editExplanation.trim()) {
      toast.error("Açıklama zorunludur.")
      return
    }
    let dueDateIso: string | null = null
    if (editDueDate.trim()) {
      const parsed = parseDdMmYyyyToUtcDate(editDueDate.trim())
      if (!parsed) {
        toast.error("Geçerli bir vade tarihi giriniz (dd.mm.yyyy).")
        return
      }
      dueDateIso = parsed.toISOString()
    }
    setSavingEdit(true)
    try {
      const isSacaSafa = isSacaOrSafaAuditCategory(finding.session?.entry.auditCategoryType.name)
      const res = await fetch(`/api/audit-findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // SACA/SAFA'da Level artık düzenlenemez — sunucu zaten yok sayar, istemcide de
          // göndermeyerek eski/varsayılan bir değerin yanlışlıkla yazılmasını önlüyoruz.
          findingLevel: isSacaSafa ? undefined : editLevel,
          findingCategory: isSacaSafa ? editCategory : null,
          explanation: editExplanation.trim(),
          reference: editReference.trim() || null,
          ...(editAssignValue?.type === "group"
            ? { assignedGroupId: editAssignValue.id }
            : { assignedToId: editAssignValue?.type === "person" ? editAssignValue.id : null }),
          dueDate: dueDateIso,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bulgu güncellenemedi.")
      toast.success("Bulgu güncellendi.")
      setEditOpen(false)
      await Promise.all([load(), loadFindingHistory()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulgu güncellenemedi.")
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDeleteFinding = async () => {
    setDeletingFinding(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Bulgu silinemedi.")
      }
      toast.success("Bulgu silindi.")
      router.push("/compliance/findings-follow-up")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulgu silinemedi.")
      setDeletingFinding(false)
      setDeleteFindingOpen(false)
    }
  }

  const loadCalisanlar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/calisanlar?limit=200", { cache: "no-store" })
      const data = await parseJson(res as globalThis.Response)
      if (Array.isArray(data)) setCalisanlar(data as CalisanLite[])
    } catch { /* ignore */ }
  }, [])

  const loadGroups = React.useCallback(async () => {
    try {
      const res = await fetch("/api/user-groups", { cache: "no-store" })
      const data = await parseJson(res as globalThis.Response)
      if (Array.isArray(data)) {
        setGroups(
          (data as { id: number; name: string; memberCount: number }[]).map((g) => ({
            id: g.id,
            label: g.name,
            memberCount: g.memberCount,
          }))
        )
      }
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => {
    void load()
    void loadCalisanlar()
    void loadGroups()
    void loadFindingFiles()
    void loadFindingHistory()
  }, [load, loadCalisanlar, loadGroups, loadFindingFiles, loadFindingHistory])

  const submitResponse = async () => {
    if (!rootCause.trim() && !correctiveAction.trim() && !preventiveAction.trim()) {
      toast.error("En az bir alan doldurulmalı.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // respondedById istemciden ARTIK GÖNDERİLMEZ — sunucu her zaman gerçek oturum
          // sahibinin kendi kaydına zorlar (bkz. requireCpaResponsiblePerson).
          rootCause: rootCause.trim() || null,
          correctiveAction: correctiveAction.trim() || null,
          preventiveAction: preventiveAction.trim() || null,
        }),
      })
      const data = (await parseJson(res as globalThis.Response)) as { id?: unknown; error?: string } | null
      if (!res.ok) {
        const msg = data && typeof data.error === "string" && data.error.trim() ? data.error.trim() : "Gönderilemedi."
        toast.error(msg)
        return
      }
      const createdId = data && typeof data.id === "number" ? data.id : NaN
      if (!Number.isFinite(createdId)) {
        toast.error("Sunucu yanıtı geçersiz. Sayfayı yenileyip tekrar deneyin.")
        return
      }
      setCreatedResponseId(createdId)

      // Upload pending files
      if (pendingFiles.length > 0) {
        setUploadingFiles(true)
        let uploadErr = false
        for (const file of pendingFiles) {
          const form = new FormData()
          form.append("file", file)
          form.append("responseId", String(createdId))
          const up = await fetch(`/api/audit-findings/${findingId}/attachments`, {
            method: "POST",
            body: form,
          })
          if (!up.ok) uploadErr = true
        }
        setUploadingFiles(false)
        setPendingFiles([])
        if (uploadErr) toast.error("Cevap kaydedildi ancak bazı ekler yüklenemedi.")
      }

      toast.success("Cevap gönderildi.")
      setResponseOpen(false)
      setRootCause("")
      setCorrectiveAction("")
      setPreventiveAction("")
      setCreatedResponseId(null)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSubmitting(false)
    }
  }

  // CPA cevabı YALNIZCA bulgunun sorumlu tarafı (kişiye atanmışsa o kişi; gruba atanmışsa
  // grubun AKTİF bir üyesi) verebilir/düzenleyebilir/resubmit edebilir. Grup üyeliği client'ta
  // HİÇ hesaplanmaz/bilinmez — server GET /api/audit-findings/[id] zaten
  // computeCpaUiPermissions() ile bu iki boolean'ı hesaplayıp döndürüyor (bkz.
  // lib/audit-finding-cpa-access.ts). Gerçek enforcement HER ZAMAN ilgili POST/PATCH route'unda.
  const isResponsiblePerson = finding?.cpaPermissions.canRespond ?? false
  const canReviewCpa = finding?.cpaPermissions.canReview ?? false

  const latestResponse = finding && finding.responses.length > 0 ? finding.responses[finding.responses.length - 1] : null
  const needsRevision = latestResponse?.cpaStatus === "RevisionRequested"
  // Sorumlu kişi yeni cevap açabilir: hiç cevap yoksa, ya da en son cevap "Düzenleme İstendi"
  // ise (resubmit). Cevap incelemedeyken veya kabul edildiyse yeni form açılmaz.
  const canSubmitOrResubmit = !latestResponse || needsRevision

  /** Yeniden gönderim ise (latest.cpaStatus === "RevisionRequested") önceki cevap prefill edilir —
   * "önceki cevap/history kaybolmasın" gereksinimi: kullanıcı sıfırdan yazmak zorunda kalmaz. */
  const openResponseDialog = (prefillFrom?: Response) => {
    setRootCause(prefillFrom?.rootCause ?? "")
    setCorrectiveAction(prefillFrom?.correctiveAction ?? "")
    setPreventiveAction(prefillFrom?.preventiveAction ?? "")
    setPendingFiles([])
    setResponseOpen(true)
  }

  const acceptCpaResponse = async (responseId: number) => {
    setAcceptingResponseId(responseId)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })
      const data = await parseJson(res as globalThis.Response).catch(() => null) as { error?: string } | null
      if (!res.ok) { toast.error((data && data.error) || "Güncellenemedi."); return }
      toast.success("CPA kabul edildi. Bulgu kapatıldı.")
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setAcceptingResponseId(null)
    }
  }

  const openRevisionRequestDialog = (responseId: number) => {
    setRevisionRequestTargetId(responseId)
    setRevisionRequestNote("")
    setRevisionRequestOpen(true)
  }

  const submitRevisionRequest = async () => {
    if (!revisionRequestTargetId) return
    if (!revisionRequestNote.trim()) {
      toast.error("Revizyon açıklaması zorunludur.")
      return
    }
    setRequestingRevision(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/responses/${revisionRequestTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revision_request", reviewNote: revisionRequestNote.trim() }),
      })
      const data = await parseJson(res as globalThis.Response).catch(() => null) as { error?: string } | null
      if (!res.ok) { toast.error((data && data.error) || "Güncellenemedi."); return }
      toast.success("Düzenleme talep edildi.")
      setRevisionRequestOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setRequestingRevision(false)
    }
  }

  const assignFinding = async () => {
    setAssigning(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          assignValue?.type === "group"
            ? { assignedGroupId: assignValue.id }
            : { assignedToId: assignValue?.type === "person" ? assignValue.id : null }
        ),
      })
      if (!res.ok) { toast.error("Atanamadı."); return }
      toast.success("Atama güncellendi.")
      setAssignOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!finding) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">Bulgu bulunamadı.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/compliance/findings-follow-up">Geri dön</Link>
        </Button>
      </div>
    )
  }

  const isOpen = finding.status === "Open"

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={finding.findingCode} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/findings-follow-up">Findings Follow Up</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{finding.findingCode}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link href="/compliance/findings-follow-up"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{finding.findingCode}</h1>
              <p className="text-muted-foreground text-sm">{finding.auditNumber ?? "—"} · {finding.field ?? "—"}</p>
            </div>
            {finding.findingLevel && (
              <Badge
                variant="outline"
                className={cn("ml-1", (findingLevelStyles[finding.findingLevel] ?? findingLevelStyles.Level1).cls)}
              >
                {(findingLevelStyles[finding.findingLevel] ?? findingLevelStyles.Level1).label}
              </Badge>
            )}
            {finding.findingCategory && (
              <Badge
                variant="outline"
                className={cn(
                  "ml-1",
                  findingCategoryStyles[finding.findingCategory as keyof typeof findingCategoryStyles]
                )}
              >
                {findingCategoryLabels[finding.findingCategory as keyof typeof findingCategoryLabels] ?? finding.findingCategory}
              </Badge>
            )}
            <Badge className={cn(
              "ml-1",
              isOpen ? "bg-blue-600 text-white" : "bg-teal-600 text-white"
            )}>
              {isOpen ? "Açık" : "Kapalı"}
            </Badge>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button type="button" variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
            )}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteFindingOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
            )}
            {isAdmin ? (
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setAssignValue(
                  finding.assignedGroup
                    ? { type: "group", id: finding.assignedGroup.id }
                    : finding.assignedTo
                      ? { type: "person", id: finding.assignedTo.id }
                      : null
                )
                setAssignOpen(true)
              }}>
                {finding.assignedGroup ? <Users className="mr-1.5 size-3.5" /> : <User className="mr-1.5 size-3.5" />}
                {finding.assignedGroup ? finding.assignedGroup.name : finding.assignedTo ? calisanName(finding.assignedTo) : "Atama yap"}
              </Button>
            ) : finding.assignedGroup ? (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1.5">
                <Users className="size-3.5" />
                {finding.assignedGroup.name}
              </Badge>
            ) : finding.assignedTo ? (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1.5">
                <User className="size-3.5" />
                {calisanName(finding.assignedTo)}
              </Badge>
            ) : null}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingReminder}
                onClick={() => void sendReminder()}
              >
                {sendingReminder ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Bell className="mr-1.5 size-3.5" />
                )}
                Send Reminder
              </Button>
            )}
            {isOpen && isResponsiblePerson && canSubmitOrResubmit && (
              <Button
                type="button"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => openResponseDialog(needsRevision ? (latestResponse ?? undefined) : undefined)}
              >
                <Send className="mr-1.5 size-3.5" />
                {needsRevision ? "Yeniden Gönder" : "Cevap Ver"}
              </Button>
            )}
          </div>
        </div>

        {/* Finding details card */}
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Bulgu Kodu</p>
              <p className="font-mono text-sm font-semibold">{finding.findingCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Denetim Numarası</p>
              <p className="text-sm">{finding.auditNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Alan</p>
              <p className="text-sm">{finding.field ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Başlangıç Tarihi</p>
              <p className="text-sm">{formatDate(finding.initializedOn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Vade Tarihi</p>
              <p className={cn("text-sm", isOpen && finding.dueDate && new Date(finding.dueDate) < new Date() ? "text-red-600 font-semibold" : "")}>
                {formatDate(finding.dueDate)}
                {isOpen && finding.dueDate && new Date(finding.dueDate) < new Date() && (
                  <AlertTriangle className="inline ml-1 size-3.5" />
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {finding.assignedGroup ? "Sorumlu Grup" : "Sorumlu"}
              </p>
              <p className="text-sm">
                {finding.assignedGroup ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {finding.assignedGroup.name}
                  </span>
                ) : finding.assignedTo ? (
                  <>
                    {calisanName(finding.assignedTo)}
                    {finding.assignedTo.departman && (
                      <span className="text-muted-foreground ml-1">({finding.assignedTo.departman})</span>
                    )}
                  </>
                ) : "—"}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-muted-foreground text-xs font-medium">Açıklama / Bulgu</p>
              <p className="text-sm leading-relaxed mt-0.5">{finding.explanation}</p>
            </div>
            {finding.reference && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">Referans</p>
                <p className="font-mono text-sm">{finding.reference}</p>
              </div>
            )}
            {finding.sessionItem && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium">Checklist Maddesi</p>
                <p className="text-sm">{finding.sessionItem.checklistItem.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Finding Files — checklist eklerinden ve Audit Files'tan bağımsız, doğrudan Finding ID'ye bağlı */}
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Paperclip className="size-4 text-muted-foreground" />
              Finding Files ({findingFiles.length})
            </h2>
            <label
              htmlFor="finding-file-upload"
              className={cn(
                "border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium shadow-xs",
                findingFilesUploading && "pointer-events-none opacity-60"
              )}
            >
              <Plus className="size-3.5" />
              {findingFilesUploading ? "Yükleniyor…" : "Add File"}
            </label>
            <input
              id="finding-file-upload"
              type="file"
              multiple
              className="hidden"
              disabled={findingFilesUploading}
              onChange={(e) => {
                if (e.target.files?.length) void handleAddFindingFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
          {findingFilesLoading ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : findingFiles.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz dosya eklenmedi.</p>
          ) : (
            <ul className="space-y-1.5">
              {findingFiles
                .filter((f): f is FindingFileRow => !!f && f.id != null)
                .map((f) => (
                  <li key={f.id} className="bg-background/60 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                    <a
                      href={`/api/audit-findings/${findingId}/files/${f.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate hover:underline"
                      title={f.fileName}
                    >
                      {f.fileName}
                    </a>
                    <span className="text-muted-foreground shrink-0">{formatFileBytes(f.fileSizeBytes)}</span>
                    <span className="text-muted-foreground shrink-0">{f.uploadedByName ?? "—"}</span>
                    <span className="text-muted-foreground shrink-0">{formatDateTime(f.createdAt)}</span>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive size-6 shrink-0"
                        onClick={() => setDeleteFileTarget(f)}
                        aria-label="Dosyayı sil"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Responses */}
        <div>
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <GitBranch className="size-4 text-blue-600" />
            Kök Neden Analizi & CPA Cevapları ({finding.responses.length})
            {latestResponse ? (
              <Badge variant="outline" className={cn("text-xs font-normal", cpaStatusConfig[latestResponse.cpaStatus]?.cls)}>
                {cpaStatusConfig[latestResponse.cpaStatus]?.label ?? latestResponse.cpaStatus}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-normal bg-muted text-muted-foreground border-border">
                Cevap Bekleniyor
              </Badge>
            )}
          </h2>

          {finding.responses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Henüz cevap verilmemiş.
              {isOpen && isResponsiblePerson && (
                <p className="mt-1">
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => openResponseDialog()}>
                    İlk cevabı gönder →
                  </Button>
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {finding.responses.map((resp, idx) => {
                const cfg = cpaStatusConfig[resp.cpaStatus] ?? cpaStatusConfig.Pending
                return (
                  <div key={resp.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
                    {/* Response header */}
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Cevap #{idx + 1}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{formatDate(resp.submittedAt)}</span>
                        {resp.respondedBy && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{calisanName(resp.respondedBy)}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-xs", cfg.cls)}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="p-4 space-y-3">
                      {resp.rootCause && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Kök Neden (Root Cause)</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.rootCause}</p>
                        </div>
                      )}
                      {resp.correctiveAction && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Düzeltici Faaliyet</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.correctiveAction}</p>
                        </div>
                      )}
                      {resp.preventiveAction && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Önleyici Faaliyet</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.preventiveAction}</p>
                        </div>
                      )}

                      {/* Attachments */}
                      {resp.attachments.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ekler</p>
                          <div className="flex flex-wrap gap-1.5">
                            {resp.attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                                <Paperclip className="size-3 shrink-0" />
                                <span className="max-w-[160px] truncate">{att.fileName}</span>
                                {att.fileSizeBytes && (
                                  <span className="text-muted-foreground">
                                    ({Math.ceil(att.fileSizeBytes / 1024)} KB)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Revizyon notu — bu response'un review'i sırasında auditor tarafından yazıldı */}
                      {resp.cpaStatus === "RevisionRequested" && resp.rejectComment && (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                          <p className="font-semibold uppercase tracking-wide mb-0.5">Denetçi Revizyon Notu</p>
                          <p className="whitespace-pre-wrap">{resp.rejectComment}</p>
                        </div>
                      )}

                      {resp.reviewedBy && (resp.cpaStatus === "Accepted" || resp.cpaStatus === "RevisionRequested") && (
                        <p className="text-muted-foreground text-xs">
                          {resp.cpaStatus === "Accepted" ? "Kabul eden" : "İnceleyen"}: {calisanName(resp.reviewedBy)}
                          {resp.reviewedAt && ` · ${formatDateTime(resp.reviewedAt)}`}
                        </p>
                      )}

                      {/* CPA Review Actions — yalnızca auditor/compliance (canReviewCpa), yalnızca en son
                          cevap ve yalnızca inceleme bekliyorken (Pending/Resubmitted). Sorumlu kişi kendi
                          cevabını asla göremez (canReviewCpa zaten isResponsiblePerson'ı dışlar). */}
                      {isOpen &&
                        idx === finding.responses.length - 1 &&
                        (resp.cpaStatus === "Pending" || resp.cpaStatus === "Resubmitted") &&
                        canReviewCpa && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                            disabled={acceptingResponseId === resp.id}
                            onClick={() => void acceptCpaResponse(resp.id)}
                          >
                            {acceptingResponseId === resp.id ? (
                              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 size-3.5" />
                            )}
                            CPA&apos;yı Kabul Et
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400"
                            disabled={acceptingResponseId === resp.id}
                            onClick={() => openRevisionRequestDialog(resp.id)}
                          >
                            <XCircle className="mr-1.5 size-3.5" />
                            Düzenleme İste
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Finding History — Reminder gönderimi, dosya yükleme/silme vb. kronolojik olaylar */}
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
            <HistoryIcon className="size-4 text-muted-foreground" />
            Finding History
          </h2>
          {findingHistoryLoading ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : findingHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz kayıtlı bir işlem yok.</p>
          ) : (
            <ul className="text-muted-foreground space-y-2 text-sm">
              {findingHistory
                .filter((h): h is FindingHistoryRow => !!h && h.id != null)
                .map((h) => (
                  <li key={h.id} className="border-border flex gap-2 border-l-2 pl-3">
                    <Clock className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <span className="text-foreground font-mono text-xs">{formatDateTime(h.createdAt)}</span>
                      {" — "}
                      {h.note?.trim() || h.eventType}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Finding */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulguyu Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* SACA/SAFA'da tek sınıflandırma Finding Category'dir — Level hiç gösterilmez. */}
              {!(finding && isSacaOrSafaAuditCategory(finding.session?.entry.auditCategoryType.name)) && (
                <div className="space-y-1.5">
                  <Label>Finding Level</Label>
                  <Select value={editLevel} onValueChange={setEditLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Level1">Level 1</SelectItem>
                      <SelectItem value="Level2">Level 2</SelectItem>
                      <SelectItem value="Observation">Gözlem (Observation)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {finding && isSacaOrSafaAuditCategory(finding.session?.entry.auditCategoryType.name) && (
                <div className="space-y-1.5">
                  <Label>Finding Category *</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FINDING_CATEGORY_VALUES.map((c) => (
                        <SelectItem key={c} value={c}>{findingCategoryLabels[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description / Açıklama *</Label>
              <Textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} className="min-h-[90px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Reference / Referans</Label>
              <Input value={editReference} onChange={(e) => setEditReference(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Responsible Person / Group</Label>
                <AssigneeCombobox
                  people={calisanlar.map((c) => ({ id: c.id, label: [c.isim, c.soyisim].filter(Boolean).join(" ") || `#${c.id}` }))}
                  groups={groups}
                  value={editAssignValue}
                  onChange={setEditAssignValue}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <DatePicker value={editDueDate} onChange={setEditDueDate} placeholder="dd.mm.yyyy" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Vazgeç</Button>
            <Button type="button" disabled={savingEdit} onClick={() => void submitEdit()}>
              {savingEdit ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Finding onayı */}
      <Dialog open={deleteFindingOpen} onOpenChange={(o) => !deletingFinding && setDeleteFindingOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulguyu Sil</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu bulguyu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz; bulgu artık listelerde görünmeyecek.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteFindingOpen(false)} disabled={deletingFinding}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deletingFinding} onClick={() => void confirmDeleteFinding()}>
              {deletingFinding ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Finding File onayı */}
      <Dialog open={!!deleteFileTarget} onOpenChange={(o) => !o && setDeleteFileTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dosya silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteFileTarget ? `“${deleteFileTarget.fileName}” kalıcı olarak silinecek.` : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteFileTarget(null)}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deletingFile} onClick={() => void confirmDeleteFindingFile()}>
              {deletingFile ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response dialog */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="!flex max-h-[min(90dvh,90vh)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pt-6 pr-14 text-left">
            <DialogTitle>{needsRevision ? "CPA Cevabını Yeniden Gönder" : "Bulguya Cevap Ver — Kök Neden Analizi"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-4 px-6 py-4 pb-2">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{finding.findingCode}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{finding.explanation}</p>
              </div>

              {needsRevision && latestResponse?.rejectComment && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  <p className="font-semibold uppercase tracking-wide mb-0.5">Denetçi Revizyon Notu</p>
                  <p className="whitespace-pre-wrap">{latestResponse.rejectComment}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Cevaplayan Kişi</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground">
                  {/* Yalnızca finding.assignedTo ile eşleşen kişi bu dialog'u açabilir — cevap
                      her zaman bu kullanıcı adına kaydedilir (bkz. isResponsiblePerson). */}
                  {calisanName(calisanlar.find((c) => c.id === currentCalisanId) ?? null)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Kök Neden (Root Cause) *</Label>
                <p className="text-muted-foreground text-xs">
                  5-Why veya Ishikawa yöntemi ile kök nedeni açıklayın.
                </p>
                <Textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Neden oluştu? Kök neden nedir?"
                  className="min-h-[90px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Düzeltici Faaliyet (Corrective Action)</Label>
                <Textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Mevcut uygunsuzluğu gidermek için yapılacaklar…"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Önleyici Faaliyet (Preventive Action)</Label>
                <Textarea
                  value={preventiveAction}
                  onChange={(e) => setPreventiveAction(e.target.value)}
                  placeholder="Tekrarlanmasını önlemek için alınacak önlemler…"
                  className="min-h-[80px]"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label>Ekler (İsteğe Bağlı)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="mr-1.5 size-3.5" />
                    Dosya Ekle
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setPendingFiles((prev) => [...prev, ...files])
                      e.target.value = ""
                    }}
                  />
                </div>
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 rounded border bg-muted/40 px-2 py-1 text-xs">
                        <FileText className="size-3 shrink-0" />
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setResponseOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={submitting || uploadingFiles}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => void submitResponse()}
            >
              {submitting || uploadingFiles ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />{uploadingFiles ? "Dosyalar yükleniyor…" : "Gönderiliyor…"}</>
              ) : (
                <><Send className="mr-1.5 size-4" />{needsRevision ? "Yeniden Gönder" : "Gönder"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulguyu Ata</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Responsible Person / Group</Label>
            <AssigneeCombobox
              people={calisanlar.map((c) => ({ id: c.id, label: calisanName(c) }))}
              groups={groups}
              value={assignValue}
              onChange={setAssignValue}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Vazgeç</Button>
            <Button type="button" disabled={assigning} onClick={assignFinding}>
              {assigning ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REVISION REQUEST DIALOG ───────────────────────────────────── */}
      <Dialog open={revisionRequestOpen} onOpenChange={setRevisionRequestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Düzenleme İste</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Sorumlu kişiye neyin eksik/yetersiz olduğunu açıklayın. Bu not cevap kartında görünecek ve
              sorumlu kişi cevabını güncelleyip yeniden gönderebilecek.
            </p>
            <Textarea
              value={revisionRequestNote}
              onChange={(e) => setRevisionRequestNote(e.target.value)}
              placeholder="Revizyon açıklamanızı yazın…"
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionRequestOpen(false)} disabled={requestingRevision}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitRevisionRequest()}
              disabled={requestingRevision || !revisionRequestNote.trim()}
            >
              {requestingRevision ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Gönderiliyor…</> : <><XCircle className="mr-1.5 size-3.5" />Düzenleme İste</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
