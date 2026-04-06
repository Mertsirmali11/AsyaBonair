"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Send, Paperclip, Loader2, Info, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type TaskRow = {
  id: number
  title: string
  status: string
  dueDate: string | null
  createdAt?: string
  assignee: { isim: string | null; soyisim: string | null } | null
  meeting: { id: number; meetingNo: string; title: string }
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

type TaskDetail = TaskRow & {
  assigneeId: number | null
  updatedAt: string
  meetingId: number
  filePath: string | null
  fileName: string | null
  assignedByName: string | null
  messages: TaskMessage[]
  attachments: TaskAttachmentRow[]
  history: HistoryRow[]
}

type CalisanOption = { id: number; isim: string | null; soyisim: string | null }

const MAX_ATTACHMENT_MB = 50
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024

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
  if (status === "In Progress") return "bg-sky-100 text-sky-900 border-sky-200"
  return "bg-violet-100 text-violet-900 border-violet-200"
}

export function TaskQuickViewDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!task) return null

  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US") : "—"
  const created = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString("en-US")
    : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick view</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Task</p>
            <p className="font-medium">{task.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant="secondary" className="mt-0.5">{task.status}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Due date</p>
              <p className="mt-0.5">{due}</p>
            </div>
            {task.createdAt && (
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="mt-0.5">{created}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Assigned to</p>
            <p>{task.assignee ? formatName(task.assignee) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Meeting</p>
            <Link
              href={`/meetings/${task.meeting.id}`}
              className="text-primary font-mono text-xs underline-offset-4 hover:underline"
            >
              {task.meeting.meetingNo}
            </Link>
            <p className="text-muted-foreground mt-0.5">{task.meeting.title}</p>
          </div>
          <Button asChild className="w-full">
            <Link href={`/meetings/${task.meeting.id}`}>Open meeting</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_OPTIONS = ["Open", "In Progress", "Completed"] as const

export function TaskManageDialog({
  taskId,
  open,
  onOpenChange,
  onUpdated,
}: {
  taskId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [messageText, setMessageText] = useState("")
  const [sending, setSending] = useState(false)
  const [employees, setEmployees] = useState<CalisanOption[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const commFileInputRef = useRef<HTMLInputElement>(null)
  const panelFileInputRef = useRef<HTMLInputElement>(null)

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
    if (open && taskId != null) {
      void load()
    }
    if (!open) {
      setMessageText("")
      setLoadError(null)
      setAttachError(null)
    }
  }, [open, taskId, load])

  useEffect(() => {
    if (!open) return
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
  }, [open])

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
    const text = messageText.trim()
    if (!text || taskId == null || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        setMessageText("")
        void load()
        onUpdated()
      }
    } finally {
      setSending(false)
    }
  }

  const uploadAttachment = async (file: File) => {
    if (taskId == null) return
    setAttachError(null)
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(`File is too large. Maximum size is ${MAX_ATTACHMENT_MB} MB.`)
      return
    }
    setUploadingFile(true)
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
    } finally {
      setUploadingFile(false)
    }
  }

  const assigneeGreeting =
    detail?.assignee != null
      ? formatName(detail.assignee).toUpperCase()
      : "TEAM MEMBER"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Tam sayfa: Dialog varsayılanındaki sm:max-w-lg ve ortalamayı geçersiz kıl
          "!fixed !inset-0 !left-0 !top-0 z-50 flex !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-xl",
          "sm:!max-w-none lg:!max-w-none",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        )}
      >
        <DialogHeader className="shrink-0 border-b bg-background px-5 py-3 text-left sm:px-6">
          <DialogTitle className="pr-10 text-base font-semibold sm:text-lg">
            {loading ? "Loading…" : detail?.title ?? "Task management"}
          </DialogTitle>
          {detail && (
            <p className="text-muted-foreground text-xs font-normal sm:text-sm">
              {detail.meeting.meetingNo} ·{" "}
              <Link
                href={`/meetings/${detail.meeting.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {detail.meeting.title}
              </Link>
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/80">
          {loadError && (
            <p className="text-destructive px-6 py-4 text-sm">{loadError}</p>
          )}
          {loading && !detail && (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading task…
            </div>
          )}

          {detail && (
            <div className="grid gap-5 p-4 lg:grid-cols-2 lg:gap-6 lg:p-6">
              {/* —— Left column —— */}
              <div className="flex flex-col gap-5">
                <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 bg-blue-600 px-4 py-2.5 text-white">
                    <h2 className="text-sm font-semibold tracking-wide">Task details</h2>
                    <Badge
                      className={cn(
                        "shrink-0 border font-normal",
                        statusBadgeClass(detail.status)
                      )}
                      variant="outline"
                    >
                      {detail.status}
                    </Badge>
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wider">
                        Title
                      </p>
                      <p className="text-base font-semibold leading-snug">{detail.title}</p>
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
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                          Assigned by
                        </p>
                        <p className="mt-1 text-sm">
                          {detail.assignedByName ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                          Consultant
                        </p>
                        <p className="mt-1 text-sm">N/A</p>
                      </div>
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                        Assigned to
                      </Label>
                      <Select
                        value={detail.assigneeId != null ? String(detail.assigneeId) : "none"}
                        onValueChange={updateAssignee}
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
                        Status
                      </Label>
                      <Select value={detail.status} onValueChange={updateStatus}>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wider">
                        Related source
                      </p>
                      <Link
                        href={`/meetings/${detail.meeting.id}`}
                        className="text-primary inline-flex items-start gap-2 text-sm leading-snug underline-offset-4 hover:underline"
                      >
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <span>{detail.meeting.title}</span>
                      </Link>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border bg-white shadow-sm">
                  <div className="border-b px-4 py-2.5">
                    <h2 className="text-sm font-semibold">Attachments</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Upload supporting files — up to {MAX_ATTACHMENT_MB} MB each (any common file type).
                    </p>
                  </div>
                  <div className="space-y-3 p-4">
                    <input
                      ref={panelFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) void uploadAttachment(f)
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={uploadingFile}
                        onClick={() => panelFileInputRef.current?.click()}
                      >
                        {uploadingFile ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Paperclip className="size-4" />
                        )}
                        Add file
                      </Button>
                      {uploadingFile && (
                        <span className="text-muted-foreground text-xs">Uploading…</span>
                      )}
                    </div>
                    {attachError && (
                      <p className="text-destructive text-sm">{attachError}</p>
                    )}

                    {detail.filePath && detail.fileName && (
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
                    )}

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
                    <h2 className="text-sm font-semibold">History</h2>
                  </div>
                  <ul className="max-h-48 space-y-2 overflow-y-auto p-4 text-sm">
                    {detail.history.map((h, i) => (
                      <li key={`${h.at}-${i}`} className="flex gap-2 text-muted-foreground">
                        <Clock className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
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

              {/* —— Right column —— */}
              <div className="flex flex-col gap-5">
                <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b px-4 py-2.5">
                    <span className="size-2 shrink-0 rounded-full bg-blue-600" aria-hidden />
                    <h2 className="text-sm font-semibold">Task assignment</h2>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                      <p className="font-medium">Dear {assigneeGreeting},</p>
                      <p className="mt-2">
                        You have been assigned an action related to meeting{" "}
                        <span className="font-mono font-semibold">{detail.meeting.meetingNo}</span>
                        {detail.dueDate && (
                          <>
                            . Please complete it by{" "}
                            <strong>
                              {new Date(detail.dueDate).toLocaleDateString("en-US")}
                            </strong>
                          </>
                        )}
                        .
                      </p>
                      <p className="mt-2 text-slate-700">
                        <strong>Task:</strong> {detail.title}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-100 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                      To respond to this action request, use the communication panel below. Your
                      messages are stored on this task for review.
                    </div>
                  </div>
                </section>

                <section className="flex min-h-[min(520px,50vh)] flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm lg:min-h-[min(640px,55vh)]">
                  <div className="bg-blue-600 px-4 py-2.5 text-white">
                    <h2 className="text-sm font-semibold">Communication panel</h2>
                    <p className="text-xs text-blue-100">Real-time discussion</p>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                    <div
                      ref={scrollRef}
                      className="min-h-[200px] flex-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/80 p-3"
                    >
                      {detail.messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                          <div className="rounded-full bg-muted p-4">
                            <Send className="size-8 opacity-40" />
                          </div>
                          <p className="max-w-xs text-sm">
                            No messages yet. Start the conversation by sending a message below.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {detail.messages.map((m) => (
                            <div
                              key={m.id}
                              className="rounded-lg border bg-white p-3 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                  {formatName(m.sender)}
                                </span>
                                <span>
                                  {new Date(m.createdAt).toLocaleString("en-US", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-slate-800">{m.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      ref={commFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) void uploadAttachment(f)
                      }}
                    />

                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor="task-reply" className="sr-only">
                        Message
                      </Label>
                      <Textarea
                        id="task-reply"
                        placeholder="Type your message here…"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="min-h-[88px] resize-none border-slate-200"
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
                          disabled={uploadingFile}
                          title={`Attach file (max ${MAX_ATTACHMENT_MB} MB)`}
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
                          className="min-w-[100px] gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          {sending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                          Send
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-right text-[11px]">
                        Ctrl+Enter to send · Attachments up to {MAX_ATTACHMENT_MB} MB
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
