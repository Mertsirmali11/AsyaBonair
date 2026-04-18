"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Info, Clock, Send, Paperclip, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type TaskRow = {
  id: number
  title: string
  status: string
  dueDate: string | null
  createdAt?: string
  assignee: { isim: string | null; soyisim: string | null } | null
  meeting: { id: number; meetingNo: string; title: string } | null
}

type TaskMessage = {
  id: number
  message: string
  createdAt: string
  sender: { isim: string | null; soyisim: string | null } | null
}

type TaskAttachmentRow = {
  id: number
  fileName: string
  filePath: string
  fileSize: number | null
  createdAt: string
}

type HistoryRow = { at: string; text: string }

export type TaskDetail = TaskRow & {
  assigneeId: number | null
  assignedById?: number | null
  rejectionReason?: string | null
  updatedAt: string
  meetingId: number | null
  filePath: string | null
  fileName: string | null
  assignedByName: string | null
  currentCalisanId?: number | null
  permissions?: { canEdit: boolean; canReview?: boolean; canSubmitProgress?: boolean; canSendMessage?: boolean }
  messages: TaskMessage[]
  attachments: TaskAttachmentRow[]
  history: HistoryRow[]
}

type CalisanOption = { id: number; isim: string | null; soyisim: string | null }

const MAX_ATTACHMENT_MB = 50
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024
const STATUS_OPTIONS = [
  "Pending Assessment",
  "Pending Review",
  "Revision Requested",
  "Completed",
  "Open",
  "In Progress",
] as const

function formatName(p: { isim: string | null; soyisim: string | null } | null) {
  if (!p) return "Unknown"
  const n = `${p.isim ?? ""} ${p.soyisim ?? ""}`.trim()
  return n || "Unknown"
}

function formatFileSize(bytes: number | null) {
  if (bytes == null || bytes < 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function dueDateInputValue(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function statusBadgeClass(status: string) {
  if (status === "Completed") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "Pending Review") return "bg-amber-100 text-amber-900 border-amber-200"
  if (status === "Revision Requested") return "bg-orange-100 text-orange-900 border-orange-200"
  if (status === "Pending Assessment") return "bg-violet-100 text-violet-900 border-violet-200"
  if (status === "In Progress") return "bg-sky-100 text-sky-900 border-sky-200"
  return "bg-slate-100 text-slate-800 border-slate-200"
}

/** 0 = değerlendirme bekleniyor, 1 = atayan incelemesi, 2 = düzeltme turu, 3 = kapatıldı */
function stepFromStatus(status: string): 0 | 1 | 2 | 3 {
  if (status === "Completed") return 3
  if (status === "Revision Requested") return 2
  if (status === "Pending Review") return 1
  if (status === "Pending Assessment" || status === "Open") return 0
  if (status === "In Progress") return 0
  return 0
}

function Stepper({ step }: { step: 0 | 1 | 2 | 3 }) {
  const items = useMemo(
    () => [
      { key: "assess", label: "PENDING ASSESSMENT" },
      { key: "review", label: "PENDING REVIEW" },
      { key: "revise", label: "REVISION" },
      { key: "done", label: "COMPLETED" },
    ],
    []
  )

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {items.map((it, idx) => {
          const active = idx <= step
          return (
            <div key={it.key} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={cn(
                  "h-2.5 flex-1 rounded-full border",
                  active ? "bg-primary border-primary" : "bg-muted border-border"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "hidden whitespace-nowrap text-[10px] font-semibold tracking-wider sm:inline",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {it.label}
              </span>
              {idx < items.length - 1 ? (
                <span className="text-muted-foreground hidden shrink-0 sm:inline">›</span>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-semibold tracking-wider text-muted-foreground sm:hidden">
        {items.map((it, idx) => (
          <div key={it.key} className={cn(idx <= step ? "text-foreground" : "")}>
            {it.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaskDetailPanel({
  taskId,
  onUpdated,
  className,
}: {
  taskId: number | null
  onUpdated: () => void
  className?: string
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)
  const [employees, setEmployees] = useState<CalisanOption[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [reviewBusy, setReviewBusy] = useState<"accept" | "reject" | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const commFileInputRef = useRef<HTMLInputElement>(null)
  const panelFileInputRef = useRef<HTMLInputElement>(null)

  const step = useMemo(() => stepFromStatus(detail?.status ?? "Pending Assessment"), [detail?.status])
  const canEdit = detail?.permissions?.canEdit === true
  const canReview = detail?.permissions?.canReview === true
  const canSendMessage = detail?.permissions?.canSendMessage === true
  const isCompleted = detail?.status === "Completed"
  // Assigner should not use message box when review is available — use Accept/Reject instead
  const isAssigner =
    detail?.currentCalisanId != null &&
    detail?.assignedById != null &&
    detail.currentCalisanId === detail.assignedById
  const showMessageInput = canSendMessage && !canReview && !(isAssigner && detail?.status === "Pending Review")
  const canUploadEvidence = !isCompleted && (canEdit || canSendMessage)

  const load = useCallback(async () => {
    if (taskId == null) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load task")
        setDetail(null)
        return
      }
      setDetail(data as TaskDetail)
    } catch {
      setLoadError("Could not load task")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (taskId == null) {
      setDetail(null)
      setLoadError(null)
      setMessageText("")
      setAttachError(null)
      return
    }
    void load()
  }, [taskId, load])

  useEffect(() => {
    void fetch("/api/calisanlar")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setEmployees(
            (data as { id: number; isim: string | null; soyisim: string | null }[]).map((c) => ({
              id: c.id,
              isim: c.isim,
              soyisim: c.soyisim,
            }))
          )
        }
      })
      .catch(() => setEmployees([]))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [detail?.messages])

  const patchTask = async (payload: Record<string, unknown>) => {
    if (taskId == null) return
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      onUpdated()
      void load()
    }
  }

  const updateStatus = (status: string) => {
    void patchTask({ status })
  }

  const updateDueDate = (value: string) => {
    void patchTask({ dueDate: value || null })
  }

  const updateAssignee = (value: string) => {
    if (value === "none") void patchTask({ assigneeId: null })
    else void patchTask({ assigneeId: Number(value) })
  }

  const sendMessage = async () => {
    if (isCompleted || !canSendMessage) return
    const text = messageText.trim()
    if (!text || taskId == null || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Mesaj gönderilemedi.")
        return
      }
      setMessageText("")
      toast.success("Gönderildi.")
      void load()
      onUpdated()
    } finally {
      setSending(false)
    }
  }

  const submitAccept = async () => {
    if (taskId == null || reviewBusy) return
    setReviewBusy("accept")
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accept" }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Kabul kaydedilemedi.")
        return
      }
      toast.success("Görev kapatıldı.")
      void load()
      onUpdated()
    } finally {
      setReviewBusy(null)
    }
  }

  const submitReject = async () => {
    if (taskId == null || reviewBusy) return
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error("Ret sebebini yazın.")
      return
    }
    setReviewBusy("reject")
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reject", reason }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ret kaydedilemedi.")
        return
      }
      toast.success("Ret bildirildi. Atanan kişi yanıtını güncelleyebilir.")
      setRejectOpen(false)
      setRejectReason("")
      void load()
      onUpdated()
    } finally {
      setReviewBusy(null)
    }
  }

  const uploadAttachment = async (file: File) => {
    if (taskId == null) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(`"${file.name}" is too large. Maximum size is ${MAX_ATTACHMENT_MB} MB.`)
      return
    }
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAttachError(typeof data.error === "string" ? data.error : "Upload failed")
        return
      }
      void load()
      onUpdated()
    } catch {
      setAttachError("Upload failed")
    }
  };

  const uploadAttachments = async (files: File[]) => {
    if (taskId == null || uploadingFile) return
    if (!canUploadEvidence) {
      setAttachError("Bu aşamada dosya ekleyemezsiniz.")
      return
    }
    const list = files.filter((f) => f && f.size > 0)
    if (list.length === 0) return
    setAttachError(null)
    setUploadingFile(true)
    try {
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAttachment(f)
      }
    } finally {
      setUploadingFile(false)
    }
  }

  if (taskId == null) {
    return (
      <div className={cn("flex h-full items-center justify-center rounded-lg border bg-card", className)}>
        <div className="max-w-md px-6 py-12 text-center">
          <p className="text-sm font-semibold">Select a task</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Choose an item from the task list to view details, messages, and evidence.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card", className)}>
      <div className="shrink-0 border-b bg-background px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              TASK-{taskId}
            </p>
            <h2 className="truncate text-base font-semibold sm:text-lg">
              {loading ? "Loading…" : detail?.title ?? "Task"}
            </h2>
            {detail?.meeting ? (
              <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                {detail.meeting.meetingNo} ·{" "}
                <Link
                  href={`/meetings/${detail.meeting.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {detail.meeting.title}
                </Link>
              </p>
            ) : null}
          </div>
          {detail ? (
            <Badge
              className={cn("shrink-0 border font-normal", statusBadgeClass(detail.status))}
              variant="outline"
            >
              {detail.status}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3">
          <Stepper step={step} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/80">
        {loadError && (
          <p className="text-destructive px-5 py-4 text-sm">{loadError}</p>
        )}
        {loading && !detail && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Loading task…
          </div>
        )}

        {detail && (
          <div className="grid gap-4 p-4 lg:grid-cols-5 lg:gap-5 lg:p-5">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2.5 text-primary-foreground">
                  <h3 className="text-sm font-semibold tracking-wide">Assignment</h3>
                  <Badge
                    className={cn("shrink-0 border font-normal", statusBadgeClass(detail.status))}
                    variant="outline"
                  >
                    {detail.status}
                  </Badge>
                </div>
                <div className="space-y-4 p-4">
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                      Assigned to
                    </Label>
                    <Select
                      value={detail.assigneeId != null ? String(detail.assigneeId) : "none"}
                      onValueChange={updateAssignee}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="max-w-md">
                        <SelectValue placeholder="Select user…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">Unassigned</SelectItem>
                        {employees.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {formatName(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                      Due date
                    </Label>
                    <Input
                      type="date"
                      className="max-w-[220px]"
                      value={dueDateInputValue(detail.dueDate)}
                      onChange={(e) => updateDueDate(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                      Status
                    </Label>
                    <Select value={detail.status} onValueChange={updateStatus} disabled={!canEdit}>
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wider">
                      Related source
                    </p>
                    {detail.meeting ? (
                      <Link
                        href={`/meetings/${detail.meeting.id}`}
                        className="text-primary inline-flex items-start gap-2 text-sm leading-snug underline-offset-4 hover:underline"
                      >
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <span>{detail.meeting.title}</span>
                      </Link>
                    ) : (
                      <p className="text-muted-foreground text-sm">No meeting — standalone task</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border bg-white shadow-sm">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">Task description</h3>
                </div>
                <div className="p-4 text-sm leading-relaxed text-slate-800">
                  <p>{detail.title}</p>
                  {detail.meeting ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Source: {detail.meeting.meetingNo} · {detail.meeting.title}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border bg-white shadow-sm">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">Evidence & attachments</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Upload supporting files — up to {MAX_ATTACHMENT_MB} MB each.
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <input
                    ref={panelFileInputRef}
                    type="file"
                    multiple
                    accept="*/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ""
                      if (files.length > 0) void uploadAttachments(files)
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={!canUploadEvidence || uploadingFile}
                      onClick={() => panelFileInputRef.current?.click()}
                    >
                      {uploadingFile ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Paperclip className="size-4" />
                      )}
                      Add file
                    </Button>
                    {uploadingFile ? (
                      <span className="text-muted-foreground text-xs">Uploading…</span>
                    ) : null}
                  </div>
                  {attachError ? (
                    <p className="text-destructive text-sm">{attachError}</p>
                  ) : null}

                  {detail.filePath && detail.fileName ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="text-muted-foreground text-xs">Legacy task file · </span>
                      <a
                        href={detail.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {detail.fileName}
                      </a>
                    </div>
                  ) : null}

                  {detail.attachments.length === 0 && !detail.filePath ? (
                    <p className="text-muted-foreground py-2 text-sm italic">No attachment</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.attachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <a
                            href={a.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary flex min-w-0 flex-1 items-center gap-2 font-medium underline-offset-4 hover:underline"
                          >
                            <Paperclip className="size-3.5 shrink-0" />
                            <span className="truncate">{a.fileName}</span>
                          </a>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {formatFileSize(a.fileSize)}
                            {" · "}
                            {new Date(a.createdAt).toLocaleDateString("en-US")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rounded-lg border bg-white shadow-sm">
                <div className="border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">History</h3>
                </div>
                <ul className="max-h-48 space-y-2 overflow-y-auto p-4 text-sm">
                  {detail.history.map((h, i) => (
                    <li key={`${h.at}-${i}`} className="flex gap-2 text-muted-foreground">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>
                        <span className="font-mono text-xs text-foreground">
                          {new Date(h.at).toLocaleDateString("en-US")}
                        </span>
                        {" — "}
                        {h.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="flex min-h-[min(520px,55vh)] flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm lg:col-span-3">
              <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2.5 text-primary-foreground">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Communication & Evidence</h3>
                  <p className="text-xs text-primary-foreground/80">
                    Atanan güncelleme gönderir; atayan kabul veya ret verir.
                  </p>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
                  Live
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                {detail.status === "Revision Requested" && detail.rejectionReason ? (
                  <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-200">
                      Son ret sebebi (atayan)
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{detail.rejectionReason}</p>
                  </div>
                ) : null}

                {canReview ? (
                  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      ⏳ Atanan kişi yanıt verdi — değerlendirmenizi yapın
                    </p>
                    <p className="text-amber-800 dark:text-amber-300 mt-1 text-xs">
                      Yanıtı yeterli buluyorsanız görevi kapatın. Yetersizse ret sebebinizi yazın, görev atanana geri döner.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        size="lg"
                        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                        disabled={reviewBusy !== null}
                        onClick={() => void submitAccept()}
                      >
                        {reviewBusy === "accept" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-5" />
                        )}
                        Kabul Et — Görevi Kapat
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="destructive"
                        className="gap-2 font-semibold"
                        disabled={reviewBusy !== null}
                        onClick={() => setRejectOpen(true)}
                      >
                        <XCircle className="size-5" />
                        Reddet
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div
                  ref={scrollRef}
                  className="min-h-[220px] flex-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/80 p-3"
                >
                  {detail.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                      <p className="text-sm">Henüz mesaj yok.</p>
                      <p className="text-xs">
                        {detail.status === "Pending Review"
                          ? "Atayan kişi değerlendirme bekliyor."
                          : "Atanan kişi güncelleme veya dosya gönderebilir."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {detail.messages.map((m) => {
                        const isRejection = m.message.startsWith("[Ret — atayan]")
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "rounded-lg border bg-white p-3 text-sm shadow-sm",
                              isRejection && "border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {isRejection ? "Ret bildirimi" : formatName(m.sender)}
                              </span>
                              <span>
                                {new Date(m.createdAt).toLocaleString("tr-TR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-slate-800">
                              {isRejection ? m.message.replace(/^\[Ret — atayan\]\n?/, "") : m.message}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <input
                  ref={commFileInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ""
                    if (files.length > 0) void uploadAttachments(files)
                  }}
                />

                {showMessageInput ? (
                  <div className="space-y-2 border-t pt-3">
                    <Label htmlFor="task-comm" className="sr-only">
                      Message
                    </Label>
                    <Textarea
                      id="task-comm"
                      placeholder="Yaptığınız işi veya yanıtınızı yazın…"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="min-h-[74px] resize-none border-slate-200"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void sendMessage()
                        }
                      }}
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={!canUploadEvidence || uploadingFile}
                        title={`Dosya ekle (en fazla ${MAX_ATTACHMENT_MB} MB)`}
                        onClick={() => commFileInputRef.current?.click()}
                      >
                        {uploadingFile ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Paperclip className="size-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={sending || !messageText.trim()}
                        className="min-w-[96px] gap-2 bg-primary hover:bg-primary/90"
                      >
                        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Gönder
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-right text-[11px]">
                      Ctrl+Enter ile gönder · Ek en fazla {MAX_ATTACHMENT_MB} MB
                    </p>
                  </div>
                ) : isCompleted ? (
                  <p className="text-muted-foreground border-t pt-3 text-center text-sm">
                    Görev tamamlandı ve kapatıldı.
                  </p>
                ) : canReview ? (
                  <p className="text-muted-foreground border-t pt-3 text-center text-sm">
                    Atanan kişinin yanıtını yukarıdan kabul veya reddedebilirsiniz.
                  </p>
                ) : detail?.status === "Pending Review" ? (
                  <p className="text-muted-foreground border-t pt-3 text-center text-sm">
                    Yanıtınız iletildi. Atayan kişinin değerlendirmesi bekleniyor.
                  </p>
                ) : (
                  <p className="text-muted-foreground border-t pt-3 text-center text-sm">
                    Bu aşamada mesaj gönderemezsiniz.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Görevi reddet</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Ret sebebi (atanan kişi görecek)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Neyin yetersiz olduğunu veya ne beklediğinizi yazın…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={reviewBusy !== null}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reviewBusy !== null || !rejectReason.trim()}
              onClick={() => void submitReject()}
            >
              {reviewBusy === "reject" ? <Loader2 className="size-4 animate-spin" /> : null}
              Reti gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

