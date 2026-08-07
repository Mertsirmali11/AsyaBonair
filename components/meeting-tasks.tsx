"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClipboardList, Loader2, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface CalisanLite {
  id: number
  isim: string | null
  soyisim: string | null
  departman?: string | null
}

interface MeetingTaskRow {
  id: number
  title: string
  status: string
  dueDate: string | null
  assignee: { isim: string | null; soyisim: string | null } | null
  assignedDepartment?: string | null
}

function parseTasksPayload(text: string, ok: boolean): MeetingTaskRow[] {
  if (!text || !ok) return []
  try {
    const data = JSON.parse(text) as unknown
    return Array.isArray(data) ? (data as MeetingTaskRow[]) : []
  } catch {
    return []
  }
}

export function MeetingTasks({
  meetingId,
  calisanlar,
  highlightTaskId = null,
}: {
  meetingId: number
  calisanlar: CalisanLite[]
  highlightTaskId?: number | null
}) {
  const [tasks, setTasks] = useState<MeetingTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [flashTaskId, setFlashTaskId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [assignMode, setAssignMode] = useState<"person" | "department">("person")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [assignedDepartment, setAssignedDepartment] = useState<string>("")
  const [dueDate, setDueDate] = useState("")

  const departmentOptions = Array.from(
    new Set(
      calisanlar
        .map((c) => c.departman?.trim())
        .filter((d): d is string => !!d)
    )
  ).sort((a, b) => a.localeCompare(b))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?meetingId=${meetingId}`)
      const text = await res.text()
      setTasks(parseTasksPayload(text, res.ok))
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    void load()
  }, [load])

  useLayoutEffect(() => {
    if (highlightTaskId == null || highlightTaskId <= 0 || loading) return
    const el = document.getElementById(`meeting-task-${highlightTaskId}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setFlashTaskId(highlightTaskId)
    const t = window.setTimeout(() => setFlashTaskId(null), 4500)
    return () => window.clearTimeout(t)
  }, [highlightTaskId, loading, tasks])

  const addTask = async () => {
    const t = title.trim()
    if (!t) return
    setSaving(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          title: t,
          assigneeId: assignMode === "person" && assigneeId ? Number(assigneeId) : null,
          assignedDepartment: assignMode === "department" && assignedDepartment ? assignedDepartment : null,
          dueDate: dueDate || null,
          status: "Open",
        }),
      })
      if (res.ok) {
        setTitle("")
        setAssigneeId("")
        setAssignedDepartment("")
        setDueDate("")
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (taskId: number, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  const removeTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
    await load()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ClipboardList size={15} className="text-muted-foreground" />
        <h3 className="font-semibold text-sm">Meeting tasks</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              id={`meeting-task-${task.id}`}
              className={cn(
                "flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs transition-shadow sm:flex-row sm:items-center sm:justify-between",
                flashTaskId === task.id &&
                  "ring-primary ring-offset-background ring-2 ring-offset-2"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{task.title}</p>
                <p className="text-muted-foreground">
                  {task.assignee
                    ? `${task.assignee.isim ?? ""} ${task.assignee.soyisim ?? ""}`.trim() || "—"
                    : task.assignedDepartment
                      ? `Dept: ${task.assignedDepartment}`
                      : "—"}
                  {task.dueDate
                    ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-US")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={task.status} onValueChange={(v) => void setStatus(task.id, v)}>
                  <SelectTrigger className="h-8 w-[9.5rem] text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => void removeTask(task.id)}
                  aria-label="Delete task"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 space-y-2 rounded-md border border-dashed border-border p-3">
        <p className="text-xs font-medium text-foreground">Add task</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={`task-title-${meetingId}`} className="text-xs">
              Title
            </Label>
            <Input
              id={`task-title-${meetingId}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task description"
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Assignee</Label>
              <div className="flex overflow-hidden rounded-md border text-[11px]">
                <button
                  type="button"
                  onClick={() => setAssignMode("person")}
                  className={cn(
                    "px-2 py-0.5",
                    assignMode === "person" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  Person
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode("department")}
                  className={cn(
                    "px-2 py-0.5",
                    assignMode === "department" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  Department
                </button>
              </div>
            </div>
            {assignMode === "person" ? (
              <Select value={assigneeId || "__none__"} onValueChange={(v) => setAssigneeId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {calisanlar.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {(c.isim ?? "") + " " + (c.soyisim ?? "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={assignedDepartment || "__none__"}
                onValueChange={(v) => setAssignedDepartment(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor={`task-due-${meetingId}`} className="text-xs">
              Due date
            </Label>
            <Input
              id={`task-due-${meetingId}`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          disabled={saving || !title.trim()}
          onClick={() => void addTask()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Add task"}
        </Button>
      </div>
    </div>
  )
}
