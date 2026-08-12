"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  History as HistoryIcon,
  Loader2,
  Paperclip,
  Plus,
  Repeat,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeMultiSelect } from "@/components/compliance/audit-plan-client"
import { DepartmentMultiSelect } from "@/components/compliance/manage-audit-client"
import { uploadPlannerTaskAttachmentsDirect } from "@/lib/client-planner-attachment-upload"
import { FINDING_FILE_ACCEPT_HTML, FINDING_FILE_TYPES_USER_MESSAGE } from "@/lib/allowed-document-uploads"
import { dbDateToDdMmYyyy, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Blocked"]
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"]
const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "Tekrarlanmaz" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMIANNUAL", label: "Every 6 Months" },
  { value: "YEARLY", label: "Yearly" },
  { value: "CUSTOM", label: "Custom (gün)" },
]

type TaskDetail = {
  id: number
  planId: number
  bucketId: number
  title: string
  description: string | null
  status: string
  priority: string
  labels: string[]
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  recurrenceRule: string | null
  recurrenceIntervalDays: number | null
  recurrenceParent: { id: number; title: string } | null
  recurrenceChildren: { id: number; title: string; createdAt: string }[]
  createdByName: string
  createdAt: string
  canEdit: boolean
  canDelete: boolean
  assignees: { id: number; name: string }[]
  departments: string[]
  checklist: { id: number; label: string; isDone: boolean; sortOrder: number }[]
  comments: { id: number; body: string; authorName: string; createdAt: string }[]
  attachments: { id: number; fileName: string; mimeType: string | null; fileSizeBytes: number | null; uploadedByName: string; createdAt: string }[]
  history: { id: number; eventType: string; note: string | null; actorName: string; createdAt: string }[]
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

function formatBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso))
  } catch {
    return iso
  }
}

const HISTORY_LABELS: Record<string, string> = {
  CREATED: "oluşturuldu",
  TITLE_CHANGED: "başlık değişti",
  ASSIGNED: "kişi atandı",
  UNASSIGNED: "kişi ataması kaldırıldı",
  DEPARTMENT_ASSIGNED: "departman atandı",
  DEPARTMENT_UNASSIGNED: "departman ataması kaldırıldı",
  DUE_DATE_CHANGED: "bitiş tarihi değişti",
  MOVED_BUCKET: "bucket değişti",
  STATUS_CHANGED: "durum değişti",
  PRIORITY_CHANGED: "öncelik değişti",
  CHECKLIST_ITEM_ADDED: "checklist maddesi eklendi",
  CHECKLIST_ITEM_COMPLETED: "checklist maddesi güncellendi",
  COMMENT_ADDED: "yorum eklendi",
  ATTACHMENT_ADDED: "dosya eklendi",
  ATTACHMENT_DELETED: "dosya silindi",
  COMPLETED: "tamamlandı",
  REOPENED: "yeniden açıldı",
  DELETED: "silindi",
  RECURRENCE_CREATED: "tekrar oluşturuldu",
}

export function PlannerTaskDetail({
  taskId,
  employees,
  departmentOptions,
  onClose,
  onChanged,
}: {
  taskId: number
  employees: { id: number; label: string }[]
  departmentOptions: string[]
  onClose: () => void
  onChanged: () => void
}) {
  const [task, setTask] = React.useState<TaskDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState("Not Started")
  const [priority, setPriority] = React.useState("Medium")
  const [startDate, setStartDate] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [labelsInput, setLabelsInput] = React.useState("")
  const [assigneeIds, setAssigneeIds] = React.useState<number[]>([])
  const [departmentNames, setDepartmentNames] = React.useState<string[]>([])
  const [recurrenceRule, setRecurrenceRule] = React.useState("NONE")
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = React.useState("30")

  const [newChecklistLabel, setNewChecklistLabel] = React.useState("")
  const [newComment, setNewComment] = React.useState("")
  const [submittingComment, setSubmittingComment] = React.useState(false)
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}`, { cache: "no-store" })
      const data = (await parseJson(res)) as TaskDetail | { error?: string } | null
      if (!res.ok || !data || "error" in data) {
        toast.error("Görev yüklenemedi.")
        onClose()
        return
      }
      const t = data as TaskDetail
      setTask(t)
      setTitle(t.title)
      setDescription(t.description ?? "")
      setStatus(t.status)
      setPriority(t.priority)
      setStartDate(t.startDate ? dbDateToDdMmYyyy(t.startDate) : "")
      setDueDate(t.dueDate ? dbDateToDdMmYyyy(t.dueDate) : "")
      setLabelsInput(t.labels.join(", "))
      setAssigneeIds(t.assignees.map((a) => a.id))
      setDepartmentNames(t.departments)
      setRecurrenceRule(t.recurrenceRule ?? "NONE")
      setRecurrenceIntervalDays(String(t.recurrenceIntervalDays ?? 30))
    } catch {
      toast.error("Görev yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [taskId, onClose])

  React.useEffect(() => {
    void load()
  }, [load])

  const patch = async (body: Record<string, unknown>, successMsg?: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Güncellenemedi.")
      if (successMsg) toast.success(successMsg)
      await load()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi.")
    } finally {
      setSaving(false)
    }
  }

  const saveFields = () =>
    patch(
      {
        title,
        description,
        priority,
        status,
        startDate: startDate ? (parseDdMmYyyyToUtcDate(startDate)?.toISOString() ?? null) : null,
        dueDate: dueDate ? (parseDdMmYyyyToUtcDate(dueDate)?.toISOString() ?? null) : null,
        labels: labelsInput.split(",").map((s) => s.trim()).filter(Boolean),
        recurrenceRule,
        recurrenceIntervalDays: recurrenceRule === "CUSTOM" ? Number(recurrenceIntervalDays) || 30 : null,
      },
      "Kaydedildi."
    )

  const saveAssignees = (ids: number[]) => {
    setAssigneeIds(ids)
    void patch({ assigneeIds: ids })
  }
  const saveDepartments = (names: string[]) => {
    setDepartmentNames(names)
    void patch({ departmentNames: names })
  }

  const addChecklistItem = async () => {
    const label = newChecklistLabel.trim()
    if (!label) return
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      })
      if (!res.ok) throw new Error()
      setNewChecklistLabel("")
      await load()
      onChanged()
    } catch {
      toast.error("Madde eklenemedi.")
    }
  }

  const toggleChecklistItem = async (itemId: number, isDone: boolean) => {
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone }),
      })
      if (!res.ok) throw new Error()
      await load()
      onChanged()
    } catch {
      toast.error("Güncellenemedi.")
    }
  }

  const removeChecklistItem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await load()
      onChanged()
    } catch {
      toast.error("Silinemedi.")
    }
  }

  const submitComment = async () => {
    const body = newComment.trim()
    if (!body) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Yorum gönderilemedi.")
      setNewComment("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yorum gönderilemedi.")
    } finally {
      setSubmittingComment(false)
    }
  }

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploadingFiles(true)
    try {
      const files = Array.from(fileList)
      const uploaded = await uploadPlannerTaskAttachmentsDirect(taskId, files)
      const res = await fetch(`/api/planner/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploaded }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Dosya kaydedilemedi.")
      toast.success(`${uploaded.length} dosya eklendi.`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dosya yüklenemedi.")
    } finally {
      setUploadingFiles(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeAttachment = async (attachmentId: number) => {
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      toast.error("Silinemedi.")
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/planner/tasks/${taskId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Görev silindi.")
      onChanged()
      onClose()
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !task) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Yükleniyor…
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const canEdit = task.canEdit
  const checklistDone = task.checklist.filter((c) => c.isDone).length

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex max-h-[min(92vh,860px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2">
            {task.recurrenceRule && <Repeat className="size-4 text-violet-500" />}
            {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            <span>Task Detail</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} onBlur={saveFields} />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} onBlur={saveFields} className="min-h-[80px]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); void patch({ status: v }) }} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => { setPriority(v); void patch({ priority: v }) }} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setStartDate(v)
                  void patch({ startDate: v ? (parseDdMmYyyyToUtcDate(v)?.toISOString() ?? null) : null })
                }}
                placeholder="dd.mm.yyyy"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <DatePicker
                value={dueDate}
                onChange={(v) => {
                  setDueDate(v)
                  void patch({ dueDate: v ? (parseDdMmYyyyToUtcDate(v)?.toISOString() ?? null) : null })
                }}
                placeholder="dd.mm.yyyy"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Labels / Tags (virgülle ayırın)</Label>
            <Input value={labelsInput} onChange={(e) => setLabelsInput(e.target.value)} disabled={!canEdit} onBlur={saveFields} placeholder="örn. urgent, camo" />
          </div>

          <div className="space-y-2">
            <Label>Recurring</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={recurrenceRule} onValueChange={(v) => { setRecurrenceRule(v); void patch({ recurrenceRule: v, recurrenceIntervalDays: v === "CUSTOM" ? Number(recurrenceIntervalDays) || 30 : null }) }} disabled={!canEdit}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {recurrenceRule === "CUSTOM" && (
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={recurrenceIntervalDays}
                  onChange={(e) => setRecurrenceIntervalDays(e.target.value)}
                  onBlur={() => void patch({ recurrenceRule: "CUSTOM", recurrenceIntervalDays: Number(recurrenceIntervalDays) || 30 })}
                  disabled={!canEdit}
                />
              )}
              {recurrenceRule === "CUSTOM" && <span className="text-muted-foreground text-xs">günde bir</span>}
            </div>
            {task.recurrenceParent && (
              <p className="text-muted-foreground text-xs">Önceki occurrence: #{task.recurrenceParent.id} — {task.recurrenceParent.title}</p>
            )}
            {task.recurrenceChildren.length > 0 && (
              <p className="text-muted-foreground text-xs">Sonraki occurrence(lar): {task.recurrenceChildren.map((c) => `#${c.id}`).join(", ")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Assigned To — Individual</Label>
            <EmployeeMultiSelect id="planner-task-assignees" label="" options={employees} selectedIds={assigneeIds} onChange={saveAssignees} placeholder="Kişi seçin…" />
          </div>
          <div className="space-y-2">
            <DepartmentMultiSelect id="planner-task-departments" label="Assigned To — Department / Group" options={departmentOptions} selected={departmentNames} onChange={saveDepartments} />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Checklist {task.checklist.length > 0 && `(${checklistDone}/${task.checklist.length})`}
              </Label>
            </div>
            <ul className="space-y-1.5">
              {task.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <Checkbox checked={item.isDone} onCheckedChange={(v) => void toggleChecklistItem(item.id, v === true)} disabled={!canEdit} />
                  <span className={cn("flex-1 text-sm", item.isDone && "text-muted-foreground line-through")}>{item.label}</span>
                  {canEdit && (
                    <button type="button" onClick={() => void removeChecklistItem(item.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={newChecklistLabel}
                  onChange={(e) => setNewChecklistLabel(e.target.value)}
                  placeholder="Yeni madde…"
                  onKeyDown={(e) => e.key === "Enter" && void addChecklistItem()}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => void addChecklistItem()}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-4" />
              Attachments ({task.attachments.length})
            </Label>
            <ul className="space-y-1.5">
              {task.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <a href={`/api/planner/tasks/${taskId}/attachments/${a.id}/file`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                    {a.fileName}
                  </a>
                  <span className="text-muted-foreground shrink-0">{formatBytes(a.fileSizeBytes)}</span>
                  {canEdit && (
                    <button type="button" onClick={() => void removeAttachment(a.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <label
                className={cn(
                  "border-input bg-background hover:bg-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-xs",
                  uploadingFiles && "pointer-events-none opacity-60"
                )}
              >
                <Plus className="size-3.5" />
                {uploadingFiles ? "Yükleniyor…" : "Add File"}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={FINDING_FILE_ACCEPT_HTML}
                  className="hidden"
                  disabled={uploadingFiles}
                  onChange={(e) => void addFiles(e.target.files)}
                />
              </label>
            )}
            <p className="text-muted-foreground text-[11px]">{FINDING_FILE_TYPES_USER_MESSAGE}</p>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Notes / Comments ({task.comments.length})</Label>
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {task.comments.map((c) => (
                <li key={c.id} className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="text-muted-foreground mt-1">{c.authorName} · {formatDateTime(c.createdAt)}</p>
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex gap-2">
                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Yorum yazın…" className="min-h-[60px] text-sm" />
                <Button type="button" size="icon" variant="outline" disabled={submittingComment} onClick={() => void submitComment()} className="shrink-0 self-end">
                  {submittingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span>Created By: {task.createdByName}</span>
            <span>Created: {formatDateTime(task.createdAt)}</span>
            <span>Completed: {formatDateTime(task.completedAt)}</span>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="flex items-center gap-1.5">
              <HistoryIcon className="size-4" />
              History
            </Label>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
              {task.history.length === 0 ? (
                <li className="text-muted-foreground">Henüz kayıt yok.</li>
              ) : (
                task.history.map((h) => (
                  <li key={h.id} className="border-border flex gap-2 border-l-2 pl-2">
                    <CalendarClock className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatDateTime(h.createdAt)}</span>{" — "}
                      <span className="font-medium">{h.actorName}</span>{" "}
                      {h.note ?? HISTORY_LABELS[h.eventType] ?? h.eventType}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3 sm:justify-between">
          {task.canDelete ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="mr-1.5 size-3.5" />
              Delete Task
            </Button>
          ) : <span />}
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => !deleting && setDeleteConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Task silinsin mi?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &quot;{task.title}&quot; silinecek. Görev listelerden gizlenir ancak geçmişi (History) kalıcı olarak korunur.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
