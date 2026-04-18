"use client"
import { useMemo, useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw } from "lucide-react"
import { TaskQuickViewDialog, type TaskRow } from "@/app/tasks/task-dialogs"
import { TaskDetailPanel } from "./task-detail-panel"
import { cn } from "@/lib/utils"

type MeetingTaskRow = TaskRow & { createdAt?: string }

async function fetchTasksFromApi(): Promise<MeetingTaskRow[]> {
  const res = await fetch("/api/tasks")
  const text = await res.text()
  if (!text) return []
  try {
    const data = JSON.parse(text) as unknown
    if (!res.ok || !Array.isArray(data)) return []
    return data as MeetingTaskRow[]
  } catch {
    return []
  }
}

function formatName(p: { isim: string | null; soyisim: string | null } | null) {
  if (!p) return "—"
  const n = `${p.isim ?? ""} ${p.soyisim ?? ""}`.trim()
  return n || "—"
}

function statusPillClass(status: string) {
  if (status === "Completed") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "Pending Review") return "bg-amber-100 text-amber-900 border-amber-200"
  if (status === "Revision Requested") return "bg-orange-100 text-orange-900 border-orange-200"
  if (status === "Pending Assessment") return "bg-violet-100 text-violet-900 border-violet-200"
  if (status === "In Progress") return "bg-sky-100 text-sky-900 border-sky-200"
  return "bg-slate-100 text-slate-800 border-slate-200"
}

export function TasksClient() {
  const [tasks, setTasks] = useState<MeetingTaskRow[]>([])
  const [quickViewTask, setQuickViewTask] = useState<MeetingTaskRow | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("All")
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  const fetchTasks = async () => {
    try {
      const rows = await fetchTasksFromApi()
      setTasks(rows)
      setSelectedTaskId((prev) => {
        if (prev != null && rows.some((t) => t.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch {
      setTasks([])
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchTasksFromApi()
      .then((rows) => {
        if (!cancelled) {
          setTasks(rows)
          setSelectedTaskId((prev) => {
            if (prev != null && rows.some((t) => t.id === prev)) return prev
            return rows[0]?.id ?? null
          })
        }
      })
      .catch(() => {
        if (!cancelled) setTasks([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const assigneeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) {
      const name = formatName(t.assignee)
      if (name !== "—") set.add(name)
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [tasks])

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) set.add(t.status)
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [tasks])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false
      if (assigneeFilter !== "All" && formatName(t.assignee) !== assigneeFilter) return false
      if (!q) return true
      const hay = [
        `task-${t.id}`,
        t.title,
        t.meeting?.meetingNo ?? "",
        t.meeting?.title ?? "",
        formatName(t.assignee),
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [tasks, statusFilter, assigneeFilter, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Action Plan</h1>
          <p className="text-muted-foreground text-sm">Görev Takibi</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void fetchTasks()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button type="button" size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-[260px]">
          <Label className="sr-only" htmlFor="task-search">
            Search
          </Label>
          <Input
            id="task-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {assigneeOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {a === "All" ? "All Assigned to" : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-muted-foreground ml-auto text-sm">
          {filtered.length} tasks
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[420px_1fr] xl:grid-cols-[480px_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-primary px-4 py-2.5 text-primary-foreground">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Task List</h2>
              <span className="text-xs text-primary-foreground/80">{filtered.length}</span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {filtered.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No tasks found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((t) => {
                    const selected = t.id === selectedTaskId
                    const overdue =
                      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed"
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTaskId(t.id)}
                        className={cn(
                          "relative w-full rounded-lg border bg-background p-3 text-left shadow-sm transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          selected
                            ? "border-primary ring-1 ring-primary/20"
                            : "hover:bg-muted/30"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-y-0 left-0 w-1.5 rounded-l-lg",
                            selected ? "bg-orange-500" : "bg-transparent"
                          )}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider">
                              TASK-{t.id}
                            </p>
                            <p className="mt-0.5 whitespace-normal break-words text-[15px] font-semibold leading-snug text-foreground">
                              {t.title}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0 border font-normal", statusPillClass(t.status))}
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                          <span className="text-muted-foreground whitespace-normal break-words">
                            {formatName(t.assignee)}
                          </span>
                          <span
                            className={cn(
                              "shrink-0",
                              overdue ? "font-semibold text-red-600" : "text-muted-foreground"
                            )}
                          >
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US") : "—"}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <TaskDetailPanel taskId={selectedTaskId} onUpdated={fetchTasks} className="h-full" />
        </div>
      </div>

      <TaskQuickViewDialog
        task={quickViewTask}
        open={quickViewTask !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setQuickViewTask(null)
        }}
      />

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setSelectedTaskId(id)
          void fetchTasks()
        }}
      />
    </div>
  )
}

function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (taskId: number) => void
}) {
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState<string>("")
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<{ id: number; isim: string | null; soyisim: string | null }[]>([])

  useEffect(() => {
    if (!open) return
    setError(null)
    void fetch("/api/calisanlar")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setEmployees(data as typeof employees)
      })
      .catch(() => setEmployees([]))
  }, [open])

  const canSave = title.trim().length > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status: "Pending Assessment",
          dueDate: dueDate || null,
          assigneeId: assigneeId === "none" ? null : Number(assigneeId),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create task")
        return
      }
      const id = Number((data as { id?: unknown }).id)
      if (!Number.isFinite(id)) {
        setError("Task created but id was missing")
        return
      }
      setTitle("")
      setDueDate("")
      setAssigneeId("none")
      onOpenChange(false)
      onCreated(id)
    } catch {
      setError("Could not create task")
    } finally {
      setSaving(false)
    }
  }

  const employeeName = (e: { isim: string | null; soyisim: string | null }) =>
    `${e.isim ?? ""} ${e.soyisim ?? ""}`.trim() || "Unknown"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-task-title">Title</Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title…"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <p className="text-muted-foreground text-xs">
            Yeni görev durumu: <strong>Pending Assessment</strong> — atanan kişi güncelleme gönderene kadar bekler.
          </p>

          <div className="space-y-2">
            <Label>Assigned to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">Unassigned</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {employeeName(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!canSave}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
