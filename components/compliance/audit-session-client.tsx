"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Minus,
  Paperclip,
  Trash2,
  Upload,
  XCircle,
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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { TooltipProvider } from "@/components/ui/tooltip"

// ─── Types ───────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
  isHeading: boolean
  reference?: string | null
  section?: string | null
}

type FindingInfo = {
  id: number
  findingCode: string
  findingLevel: string
  status: string
}

type Attachment = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedBy: string
  uploadedAt: string
}

type SessionItemState = {
  id?: number          // set after first save
  result: string       // "" | "S" | "U" | "NA" | "OBS"
  notes: string        // auditor notes
  finding: FindingInfo | null
  attachments: Attachment[]
  dirty: boolean
  saving: boolean
  uploading: boolean
}

type AssignedChecklist = {
  assignmentId: number
  checklistId: number
  title: string
  checklistNumber: string | null
  itemCount: number
}

type AuditEntryData = {
  id: string
  auditNumber: string
  field: string
  status: string
  assignedChecklists: AssignedChecklist[]
}

type AuditSession = {
  id: number
  auditPlanEntryId: number
  auditChecklistId: number
  status: string
  checklist: { id: number; title: string; checklistNumber: string | null; items: ChecklistItem[] }
  items: {
    id: number
    auditChecklistItemId: number
    result: string | null
    notes: string | null
    finding: FindingInfo | null
    attachments: Attachment[]
  }[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ResultKey = "S" | "U" | "NA" | "OBS"

const resultConfig: Record<ResultKey, { label: string; icon: React.ReactNode; cls: string; activeCls: string }> = {
  S: {
    label: "Satisfactory",
    icon: <CheckCircle2 className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    activeCls: "border-emerald-400 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/40",
  },
  U: {
    label: "Unsatisfactory",
    icon: <XCircle className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30",
    activeCls: "border-red-400 text-red-700 bg-red-50 dark:text-red-400 dark:border-red-700 dark:bg-red-950/40",
  },
  NA: {
    label: "N/A",
    icon: <Minus className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30",
    activeCls: "border-slate-400 text-slate-600 bg-slate-50 dark:text-slate-400 dark:border-slate-600 dark:bg-slate-900/40",
  },
  OBS: {
    label: "Observation",
    icon: <Eye className="size-3.5" />,
    cls: "border-border text-muted-foreground hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30",
    activeCls: "border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/40",
  },
}

const FINDING_LEVELS = [
  { value: "Level1", label: "Level 1 Bulgu", desc: "10 gün içinde yanıt beklenir", color: "text-red-700 dark:text-red-400" },
  { value: "Level2", label: "Level 2 Bulgu", desc: "90 gün içinde yanıt beklenir", color: "text-orange-700 dark:text-orange-400" },
  { value: "Observation", label: "Gözlem", desc: "Süre verilmez", color: "text-amber-700 dark:text-amber-400" },
]

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

function formatBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuditSessionClient({ auditPlanEntryId }: { auditPlanEntryId: number }) {
  const router = useRouter()
  const [entry, setEntry] = React.useState<AuditEntryData | null>(null)
  const [sessionData, setSessionData] = React.useState<AuditSession | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = React.useState<number | null>(null)
  const [itemStates, setItemStates] = React.useState<Record<number, SessionItemState>>({})
  const [loading, setLoading] = React.useState(true)
  const [completing, setCompleting] = React.useState(false)
  const [confirmComplete, setConfirmComplete] = React.useState(false)

  // Finding level dialog
  const [findingDialog, setFindingDialog] = React.useState<{
    open: boolean
    itemId: number
    selectedLevel: string
  }>({ open: false, itemId: 0, selectedLevel: "Level1" })

  // ─── Load entry ──────────────────────────────────────────────────────────

  const loadEntry = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${auditPlanEntryId}`, { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok || !data) { toast.error("Denetim planı yüklenemedi."); return }
      setEntry(data as AuditEntryData)
    } catch {
      toast.error("Yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [auditPlanEntryId])

  React.useEffect(() => { void loadEntry() }, [loadEntry])

  // Auto-select first checklist
  React.useEffect(() => {
    if (entry && entry.assignedChecklists.length > 0 && selectedChecklistId === null) {
      setSelectedChecklistId(entry.assignedChecklists[0].checklistId)
    }
  }, [entry, selectedChecklistId])

  // ─── Start/load session ──────────────────────────────────────────────────

  const startSession = React.useCallback(async (checklistId: number) => {
    try {
      const res = await fetch("/api/audit-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditPlanEntryId, auditChecklistId: checklistId }),
      })
      const data = await parseJson(res)
      if (!res.ok) { toast.error("Oturum başlatılamadı."); return }
      const sess = data as AuditSession
      setSessionData(sess)

      // Build item state map
      const stateMap: Record<number, SessionItemState> = {}
      for (const sItem of sess.items) {
        stateMap[sItem.auditChecklistItemId] = {
          id: sItem.id,
          result: sItem.result ?? "",
          notes: sItem.notes ?? "",
          finding: sItem.finding ?? null,
          attachments: sItem.attachments ?? [],
          dirty: false,
          saving: false,
          uploading: false,
        }
      }
      setItemStates(stateMap)
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }, [auditPlanEntryId])

  React.useEffect(() => {
    if (selectedChecklistId !== null) {
      void startSession(selectedChecklistId)
    }
  }, [selectedChecklistId, startSession])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const defaultState = (): SessionItemState => ({
    id: undefined, result: "", notes: "", finding: null,
    attachments: [], dirty: false, saving: false, uploading: false,
  })

  const getState = (itemId: number): SessionItemState =>
    itemStates[itemId] ?? defaultState()

  const patchState = (itemId: number, patch: Partial<SessionItemState>) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? defaultState()), ...patch },
    }))
  }

  // ─── Save item to server ──────────────────────────────────────────────────

  const sessionIdRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    sessionIdRef.current = sessionData?.id ?? null
  }, [sessionData])

  const saveItem = React.useCallback(async (
    itemId: number,
    result: string,
    notes: string,
    findingLevel: string,
  ) => {
    const sid = sessionIdRef.current
    if (!sid) return
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { id: undefined, result: "", notes: "", finding: null, attachments: [], dirty: false, uploading: false }), saving: true },
    }))
    try {
      const res = await fetch(`/api/audit-sessions/${sid}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditChecklistItemId: itemId,
          result: result || null,
          notes: notes || null,
          findingLevel,
        }),
      })
      const data = await parseJson(res) as Record<string, unknown> | null
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Kaydedilemedi.")
        return
      }
      const finding = (data?.finding ?? null) as FindingInfo | null
      const attachments = (data?.attachments ?? []) as Attachment[]
      setItemStates((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? { id: undefined, result: "", notes: "", finding: null, attachments: [], uploading: false }), id: data?.id as number | undefined, finding, attachments, dirty: false, saving: false },
      }))
    } catch {
      toast.error("Kaydedilemedi.")
      setItemStates((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? { id: undefined, result: "", notes: "", finding: null, attachments: [], dirty: false, uploading: false }), saving: false },
      }))
    }
  }, [])

  // ─── Result click ─────────────────────────────────────────────────────────

  const handleResultClick = (itemId: number, r: ResultKey) => {
    if (!sessionData || sessionData.status === "Completed") return
    const st = getState(itemId)
    const newResult = st.result === r ? "" : r

    if (newResult === "U") {
      // Open finding level dialog
      setFindingDialog({ open: true, itemId, selectedLevel: st.finding?.findingLevel ?? "Level1" })
      return
    }

    patchState(itemId, { result: newResult, dirty: true })
    void saveItem(itemId, newResult, st.notes, st.finding?.findingLevel ?? "Level1")
  }

  // ─── Finding level dialog confirm ─────────────────────────────────────────

  const confirmFindingLevel = () => {
    const { itemId, selectedLevel } = findingDialog
    const st = getState(itemId)
    setFindingDialog((p) => ({ ...p, open: false }))
    patchState(itemId, { result: "U", dirty: true })
    void saveItem(itemId, "U", st.notes, selectedLevel)
  }

  // ─── Notes save ───────────────────────────────────────────────────────────

  const saveNotes = (itemId: number) => {
    const st = getState(itemId)
    if (!st.dirty) return
    void saveItem(itemId, st.result, st.notes, st.finding?.findingLevel ?? "Level1")
  }

  // ─── File upload ──────────────────────────────────────────────────────────

  const uploadFiles = async (itemId: number, files: FileList) => {
    const sid = sessionIdRef.current
    const st = getState(itemId)
    if (!st.id || !sid) { toast.error("Önce bir sonuç seçin."); return }
    patchState(itemId, { uploading: true })
    const uploaded: Attachment[] = []
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("uploadedBy", "auditor")
        const res = await fetch(
          `/api/audit-sessions/${sid}/items/${st.id}/attachments`,
          { method: "POST", body: fd }
        )
        if (!res.ok) { toast.error(`${file.name} yüklenemedi.`); continue }
        const att = await parseJson(res) as Attachment
        uploaded.push(att)
      }
      if (uploaded.length > 0) {
        setItemStates((prev) => ({
          ...prev,
          [itemId]: { ...(prev[itemId] ?? defaultState()), attachments: [...(prev[itemId]?.attachments ?? []), ...uploaded] },
        }))
        toast.success(`${uploaded.length} dosya yüklendi.`)
      }
    } catch {
      toast.error("Yükleme başarısız.")
    } finally {
      patchState(itemId, { uploading: false })
    }
  }

  const removeAttachment = async (itemId: number, attachmentId: number) => {
    const st = getState(itemId)
    if (!st.id || !sessionData) return
    try {
      await fetch(
        `/api/audit-sessions/${sessionData.id}/items/${st.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      )
      patchState(itemId, { attachments: getState(itemId).attachments.filter((a) => a.id !== attachmentId) })
    } catch {
      toast.error("Silinemedi.")
    }
  }

  // ─── Complete session ────────────────────────────────────────────────────

  const completeSession = async () => {
    if (!sessionData) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/audit-sessions/${sessionData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      })
      if (!res.ok) { toast.error("Tamamlanamadı."); return }
      toast.success("Denetim tamamlandı. Bulgular oluşturuldu.")
      router.push(`/compliance/audit-plan`)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCompleting(false)
      setConfirmComplete(false)
    }
  }

  // ─── Derived values ──────────────────────────────────────────────────────

  const items = sessionData?.checklist?.items ?? []
  const questionItems = items.filter((it) => !it.isHeading)
  const answeredCount = questionItems.filter((it) => getState(it.id).result !== "").length
  const unsatisfactoryCount = questionItems.filter((it) => getState(it.id).result === "U").length
  const completed = sessionData?.status === "Completed"

  let questionNumber = 0

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title="Denetim Yürüt" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">

        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/audit-plan">Audit Plan</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Denetim Yürüt</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link href="/compliance/audit-plan"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <ClipboardCheck className="size-5 text-emerald-600" />
                {loading ? "Yükleniyor…" : entry ? `Denetim — ${entry.field}` : "Denetim"}
              </h1>
              {entry && (
                <p className="text-muted-foreground text-sm mt-0.5">{entry.auditNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionData && !completed && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setConfirmComplete(true)}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Denetimi Tamamla
              </Button>
            )}
            {completed && (
              <Badge className="bg-teal-600 text-white">Tamamlandı</Badge>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {sessionData && questionItems.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(answeredCount / questionItems.length) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {answeredCount}/{questionItems.length} yanıtlandı
              {unsatisfactoryCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">· {unsatisfactoryCount} bulgu</span>
              )}
            </span>
          </div>
        )}

        {/* Checklist selector */}
        {entry && entry.assignedChecklists.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium shrink-0">Checklist:</span>
            <Select
              value={String(selectedChecklistId)}
              onValueChange={(v) => setSelectedChecklistId(Number(v))}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entry.assignedChecklists.map((a) => (
                  <SelectItem key={a.checklistId} value={String(a.checklistId)}>
                    {a.checklistNumber ?? `CL-${a.checklistId}`} — {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* No checklists */}
        {!loading && entry && entry.assignedChecklists.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="inline mr-2 size-4" />
            Bu denetim planına checklist atanmamış. Önce Audit Plan&apos;dan bir checklist atayın.
          </div>
        )}

        {/* Question list */}
        {sessionData && items.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <ScrollArea className="h-[min(70vh,800px)]">
              <div className="divide-y">
                {items.map((item) => {
                  // ── Heading ──
                  if (item.isHeading) {
                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-400"
                      >
                        <p className="font-semibold text-amber-900 dark:text-amber-200">
                          {item.label}
                        </p>
                      </div>
                    )
                  }

                  // ── Question ──
                  questionNumber++
                  const st = getState(item.id)
                  const isU = st.result === "U"
                  const isOBS = st.result === "OBS"
                  const finding = st.finding

                  return (
                    <div key={item.id} className={cn(
                      "px-4 py-4 transition-colors",
                      isU && "bg-red-50/40 dark:bg-red-950/10",
                      isOBS && "bg-amber-50/40 dark:bg-amber-950/10",
                    )}>
                      {/* Question row */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                        {/* Number + text */}
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span className="text-muted-foreground shrink-0 font-mono text-xs pt-0.5 w-6 text-right">
                            {questionNumber}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-relaxed">{item.label}</p>
                            {item.reference && (
                              <p className="text-muted-foreground font-mono text-xs mt-0.5">
                                Ref: {item.reference}
                              </p>
                            )}
                            {finding && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge
                                  className={cn(
                                    "text-xs px-1.5 py-0",
                                    finding.findingLevel === "Level1" && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
                                    finding.findingLevel === "Level2" && "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
                                    finding.findingLevel === "Observation" && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                                  )}
                                >
                                  {finding.findingCode}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {finding.findingLevel === "Level1" && "Level 1"}
                                  {finding.findingLevel === "Level2" && "Level 2"}
                                  {finding.findingLevel === "Observation" && "Gözlem"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* S / U / NA / OBS buttons */}
                        <div className="flex shrink-0 gap-1">
                          {(["S", "U", "NA", "OBS"] as ResultKey[]).map((r) => {
                            const cfg = resultConfig[r]
                            const active = st.result === r
                            return (
                              <button
                                key={r}
                                type="button"
                                disabled={completed || st.saving}
                                onClick={() => handleResultClick(item.id, r)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-all",
                                  active ? cfg.activeCls : cfg.cls,
                                  (completed || st.saving) && "opacity-60 cursor-not-allowed"
                                )}
                                title={cfg.label}
                              >
                                {cfg.icon}
                                <span className="hidden sm:inline">{r}</span>
                                <span className="sm:hidden">{r === "OBS" ? "OBS" : r}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Expanded: only when result selected or has content */}
                      {(st.result || st.notes || st.attachments.length > 0) && (
                        <div className="mt-3 ml-9 space-y-3">

                          {/* U: finding notice */}
                          {isU && (
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-red-700 dark:text-red-400 text-xs font-medium">
                              <span className="inline-flex items-start gap-1.5">
                                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                                {finding
                                  ? <>Bulgu oluşturuldu: <span className="font-mono">{finding.findingCode}</span></>
                                  : "Bu madde bulgu olarak kaydedilecek"
                                }
                              </span>
                              {finding && (
                                <Link
                                  href={`/compliance/findings-follow-up/${finding.id}`}
                                  className="inline-flex shrink-0 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950"
                                >
                                  Bulguya cevap ver (CPA)
                                </Link>
                              )}
                            </div>
                          )}

                          {/* OBS: observation notice */}
                          {isOBS && (
                            <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-medium">
                              <Eye className="size-3.5 mt-0.5 shrink-0" />
                              Gözlem olarak kaydedildi
                            </div>
                          )}

                          {/* Auditor notes */}
                          <Textarea
                            value={st.notes}
                            onChange={(e) => patchState(item.id, { notes: e.target.value, dirty: true })}
                            onBlur={() => saveNotes(item.id)}
                            placeholder="Denetçi notu (isteğe bağlı)…"
                            className="min-h-[60px] text-xs"
                            disabled={completed}
                          />

                          {/* Attachments */}
                          <div>
                            {st.attachments.length > 0 && (
                              <ul className="space-y-1 mb-2">
                                {st.attachments.map((att) => (
                                  <li key={att.id} className="flex items-center gap-2 text-xs rounded bg-muted/50 px-2 py-1">
                                    <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                                    <span className="flex-1 truncate">{att.fileName}</span>
                                    <span className="text-muted-foreground shrink-0">{formatBytes(att.fileSizeBytes)}</span>
                                    {!completed && (
                                      <button
                                        type="button"
                                        onClick={() => void removeAttachment(item.id, att.id)}
                                        className="text-destructive hover:text-destructive/80 shrink-0"
                                      >
                                        <Trash2 className="size-3" />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {!completed && (
                              <label className={cn(
                                "inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors",
                                st.uploading && "opacity-60 pointer-events-none"
                              )}>
                                <Upload className="size-3.5" />
                                {st.uploading ? "Yükleniyor…" : "Dosya Ekle"}
                                <input
                                  type="file"
                                  multiple
                                  className="sr-only"
                                  disabled={st.uploading}
                                  onChange={(e) => {
                                    if (e.target.files?.length) void uploadFiles(item.id, e.target.files)
                                    e.target.value = ""
                                  }}
                                />
                              </label>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* ── Finding Level Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={findingDialog.open}
        onOpenChange={(open) => {
          if (!open) setFindingDialog((p) => ({ ...p, open: false }))
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-4 text-red-600" />
              Bulgu Seviyesi Seçin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {FINDING_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => setFindingDialog((p) => ({ ...p, selectedLevel: lvl.value }))}
                className={cn(
                  "w-full rounded-lg border-2 px-4 py-3 text-left transition-colors",
                  findingDialog.selectedLevel === lvl.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className={cn("font-semibold text-sm", lvl.color)}>{lvl.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{lvl.desc}</div>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFindingDialog((p) => ({ ...p, open: false }))}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmFindingLevel}
            >
              Bulgu Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetimi tamamla?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Denetim tamamlandıktan sonra değişiklik yapılamaz.</p>
            {unsatisfactoryCount > 0 && (
              <p className="text-red-700 dark:text-red-400 font-medium">
                <AlertTriangle className="inline mr-1.5 size-4" />
                {unsatisfactoryCount} adet &ldquo;Unsatisfactory&rdquo; bulgu Findings Follow Up&apos;a eklenecek.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmComplete(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={completing}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={completeSession}
            >
              {completing ? "Tamamlanıyor…" : "Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
