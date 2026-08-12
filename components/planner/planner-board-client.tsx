"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat,
  Search,
  Settings,
  Trash2,
  Users,
} from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { PlannerTaskDetail } from "@/components/planner/planner-task-detail"
import { PlannerMembersDialog } from "@/components/planner/planner-members-dialog"
import { cn } from "@/lib/utils"

type BucketRow = { id: number; name: string; sortOrder: number }
type TaskRow = {
  id: number
  bucketId: number
  title: string
  description: string | null
  sortOrder: number
  status: string
  priority: string
  labels: string[]
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  recurrenceRule: string | null
  assignees: { id: number; name: string }[]
  departments: string[]
  checklistTotal: number
  checklistDone: number
  commentCount: number
  attachmentCount: number
}
type PlanDetail = {
  id: number
  name: string
  description: string | null
  color: string | null
  role: "OWNER" | "MANAGER" | "MEMBER"
  buckets: BucketRow[]
}

const ALL = "__all__"

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

function computeSortOrder(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 0
  if (prev === undefined) return (next as number) - 1
  if (next === undefined) return prev + 1
  return (prev + next) / 2
}

/** Overdue/Due Today/Due Soon (≤3 gün) — Board'da net görsel ayrım. */
function dueStatus(dueDate: string | null, status: string): "overdue" | "today" | "soon" | null {
  if (!dueDate || status === "Completed") return null
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return "overdue"
  if (diffDays === 0) return "today"
  if (diffDays <= 3) return "soon"
  return null
}

const DUE_STYLES: Record<"overdue" | "today" | "soon", { label: string; cls: string; cardCls: string }> = {
  overdue: {
    label: "Overdue",
    cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    cardCls: "border-l-4 border-l-red-500",
  },
  today: {
    label: "Due Today",
    cls: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
    cardCls: "border-l-4 border-l-orange-500",
  },
  soon: {
    label: "Due Soon",
    cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    cardCls: "border-l-4 border-l-amber-400",
  },
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  Urgent: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
}

export function PlannerBoardClient({ planId }: { planId: number }) {
  const [plan, setPlan] = React.useState<PlanDetail | null>(null)
  const [tasks, setTasks] = React.useState<TaskRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [employees, setEmployees] = React.useState<{ id: number; label: string }[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>([])

  const [openTaskId, setOpenTaskId] = React.useState<number | null>(null)
  const [membersOpen, setMembersOpen] = React.useState(false)
  const [activeDragId, setActiveDragId] = React.useState<number | null>(null)

  // ─── Filters / Search ──────────────────────────────────────────────────
  const [search, setSearch] = React.useState("")
  const [assignedToFilter, setAssignedToFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState(ALL)
  const [priorityFilter, setPriorityFilter] = React.useState(ALL)
  const [bucketFilter, setBucketFilter] = React.useState(ALL)
  const [labelFilter, setLabelFilter] = React.useState(ALL)
  const [departmentFilter, setDepartmentFilter] = React.useState(ALL)
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  // ─── New bucket / new task dialogs ─────────────────────────────────────
  const [newBucketOpen, setNewBucketOpen] = React.useState(false)
  const [newBucketName, setNewBucketName] = React.useState("")
  const [newTaskBucketId, setNewTaskBucketId] = React.useState<number | null>(null)
  const [newTaskTitle, setNewTaskTitle] = React.useState("")
  const [creatingTask, setCreatingTask] = React.useState(false)
  const [creatingBucket, setCreatingBucket] = React.useState(false)
  const [deleteBucketTarget, setDeleteBucketTarget] = React.useState<BucketRow | null>(null)
  const [deletingBucket, setDeletingBucket] = React.useState(false)

  const loadPlan = React.useCallback(async () => {
    const res = await fetch(`/api/planner/plans/${planId}`, { cache: "no-store" })
    const data = (await parseJson(res)) as PlanDetail | { error?: string } | null
    if (!res.ok || !data || "error" in data) {
      toast.error("Plan yüklenemedi.")
      return
    }
    setPlan(data as PlanDetail)
  }, [planId])

  const loadTasks = React.useCallback(async () => {
    const res = await fetch(`/api/planner/plans/${planId}/tasks`, { cache: "no-store" })
    const data = await parseJson(res)
    setTasks(res.ok && Array.isArray(data) ? (data as TaskRow[]) : [])
  }, [planId])

  React.useEffect(() => {
    setLoading(true)
    Promise.all([loadPlan(), loadTasks()]).finally(() => setLoading(false))
  }, [loadPlan, loadTasks])

  React.useEffect(() => {
    ;(async () => {
      try {
        const [empRes, deptRes] = await Promise.all([fetch("/api/calisanlar"), fetch("/api/planner/departments")])
        const empData = (await empRes.json().catch(() => [])) as { id: number; isim: string | null; soyisim: string | null }[]
        setEmployees(
          Array.isArray(empData)
            ? empData.map((c) => ({ id: c.id, label: [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || `ID ${c.id}` }))
            : []
        )
        const deptData = await deptRes.json().catch(() => [])
        setDepartmentOptions(Array.isArray(deptData) ? deptData : [])
      } catch {
        // sessiz
      }
    })()
  }, [])

  const labelOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) for (const l of t.labels) set.add(l)
    return Array.from(set).sort()
  }, [tasks])

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR")
    return tasks.filter((t) => {
      if (statusFilter !== ALL && t.status !== statusFilter) return false
      if (priorityFilter !== ALL && t.priority !== priorityFilter) return false
      if (bucketFilter !== ALL && String(t.bucketId) !== bucketFilter) return false
      if (labelFilter !== ALL && !t.labels.includes(labelFilter)) return false
      if (departmentFilter !== ALL && !t.departments.includes(departmentFilter)) return false
      if (assignedToFilter !== ALL && !t.assignees.some((a) => String(a.id) === assignedToFilter)) return false
      if (q) {
        const haystack = [
          t.title,
          t.description ?? "",
          ...t.assignees.map((a) => a.name),
          ...t.departments,
        ]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, search, statusFilter, priorityFilter, bucketFilter, labelFilter, departmentFilter, assignedToFilter])

  const tasksByBucket = React.useMemo(() => {
    const map = new Map<number, TaskRow[]>()
    for (const t of filteredTasks) {
      const arr = map.get(t.bucketId) ?? []
      arr.push(t)
      map.set(t.bucketId, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return map
  }, [filteredTasks])

  const activeFilterCount = [assignedToFilter, statusFilter, priorityFilter, bucketFilter, labelFilter, departmentFilter].filter((v) => v !== ALL).length

  const canManage = plan?.role === "OWNER" || plan?.role === "MANAGER"

  // ─── Drag & Drop — bucket değişimi ve aynı bucket içi sıralama TEK istekle anında kalıcı olur ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )

  const persistMove = React.useCallback(
    async (taskId: number, bucketId: number, sortOrder: number) => {
      try {
        const res = await fetch(`/api/planner/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucketId, sortOrder }),
        })
        if (!res.ok) throw new Error()
      } catch {
        toast.error("Taşıma kaydedilemedi, sayfa yenileniyor.")
        void loadTasks()
      }
    },
    [loadTasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    const overIdStr = String(over.id)
    let targetBucketId: number
    let overTaskId: number | null = null
    if (overIdStr.startsWith("bucket-")) {
      targetBucketId = Number(overIdStr.replace("bucket-", ""))
    } else {
      overTaskId = Number(over.id)
      const overTask = tasks.find((t) => t.id === overTaskId)
      if (!overTask) return
      targetBucketId = overTask.bucketId
    }

    const destTasks = tasks
      .filter((t) => t.bucketId === targetBucketId && t.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    let newIndex = destTasks.length
    if (overTaskId !== null) {
      const idx = destTasks.findIndex((t) => t.id === overTaskId)
      if (idx !== -1) newIndex = idx
    }

    const prevOrder = newIndex > 0 ? destTasks[newIndex - 1].sortOrder : undefined
    const nextOrder = newIndex < destTasks.length ? destTasks[newIndex].sortOrder : undefined
    const newSortOrder = computeSortOrder(prevOrder, nextOrder)

    if (activeTask.bucketId === targetBucketId && activeTask.sortOrder === newSortOrder) return

    setTasks((prev) => prev.map((t) => (t.id === activeId ? { ...t, bucketId: targetBucketId, sortOrder: newSortOrder } : t)))
    void persistMove(activeId, targetBucketId, newSortOrder)
  }

  const openNewTask = (bucketId: number) => {
    setNewTaskBucketId(bucketId)
    setNewTaskTitle("")
  }

  const submitNewTask = async () => {
    if (!newTaskBucketId || !newTaskTitle.trim()) return
    setCreatingTask(true)
    try {
      const res = await fetch(`/api/planner/plans/${planId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle.trim(), bucketId: newTaskBucketId }),
      })
      const data = (await parseJson(res)) as { id?: number; error?: string } | null
      if (!res.ok || !data?.id) throw new Error(data?.error || "Görev oluşturulamadı.")
      toast.success("Görev oluşturuldu.")
      setNewTaskBucketId(null)
      await loadTasks()
      setOpenTaskId(data.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Görev oluşturulamadı.")
    } finally {
      setCreatingTask(false)
    }
  }

  const submitNewBucket = async () => {
    if (!newBucketName.trim()) return
    setCreatingBucket(true)
    try {
      const res = await fetch(`/api/planner/plans/${planId}/buckets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBucketName.trim() }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Bucket oluşturulamadı.")
      toast.success("Bucket eklendi.")
      setNewBucketOpen(false)
      setNewBucketName("")
      await loadPlan()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bucket oluşturulamadı.")
    } finally {
      setCreatingBucket(false)
    }
  }

  const confirmDeleteBucket = async () => {
    if (!deleteBucketTarget) return
    setDeletingBucket(true)
    try {
      const res = await fetch(`/api/planner/plans/${planId}/buckets/${deleteBucketTarget.id}`, { method: "DELETE" })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Silinemedi.")
      toast.success("Bucket silindi.")
      setDeleteBucketTarget(null)
      await loadPlan()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi.")
    } finally {
      setDeletingBucket(false)
    }
  }

  if (loading || !plan) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-6">
      <SetWorkspacePageTitle title={plan.name} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
            <Link href="/planner"><ArrowLeft className="size-4" /></Link>
          </Button>
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: plan.color ?? "#64748b" }} />
          <h1 className="text-xl font-semibold tracking-tight">{plan.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
            <Users className="mr-1.5 size-3.5" />
            Members
          </Button>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={() => setNewBucketOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              New Bucket
            </Button>
          )}
        </div>
      </div>

      {/* Filters / Search */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, description, assignee, department…" className="h-8 pl-8 text-sm" />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setFiltersOpen((v) => !v)}>
          <Settings className="size-3.5" />
          Filters
          {activeFilterCount > 0 && <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-[10px]">{activeFilterCount}</span>}
        </Button>
      </div>
      {filtersOpen && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect label="Assigned To" value={assignedToFilter} onChange={setAssignedToFilter} options={employees.map((e) => ({ value: String(e.id), label: e.label }))} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={["Not Started", "In Progress", "Completed", "Blocked"].map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["Low", "Medium", "High", "Urgent"].map((p) => ({ value: p, label: p }))} />
          <FilterSelect label="Bucket" value={bucketFilter} onChange={setBucketFilter} options={plan.buckets.map((b) => ({ value: String(b.id), label: b.name }))} />
          <FilterSelect label="Label" value={labelFilter} onChange={setLabelFilter} options={labelOptions.map((l) => ({ value: l, label: l }))} />
          <FilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions.map((d) => ({ value: d, label: d }))} />
        </div>
      )}

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {plan.buckets.map((bucket) => (
            <BucketColumn
              key={bucket.id}
              bucket={bucket}
              tasks={tasksByBucket.get(bucket.id) ?? []}
              canManage={canManage}
              onAddTask={() => openNewTask(bucket.id)}
              onDeleteBucket={() => setDeleteBucketTarget(bucket)}
              onOpenTask={setOpenTaskId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDragId ? <TaskCardPreview task={tasks.find((t) => t.id === activeDragId) ?? null} /> : null}
        </DragOverlay>
      </DndContext>

      {openTaskId && (
        <PlannerTaskDetail
          taskId={openTaskId}
          employees={employees}
          departmentOptions={departmentOptions}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => void loadTasks()}
        />
      )}

      {membersOpen && (
        <PlannerMembersDialog planId={planId} canManage={canManage} employees={employees} onClose={() => setMembersOpen(false)} />
      )}

      {/* New Task dialog */}
      <Dialog open={newTaskBucketId !== null} onOpenChange={(o) => !creatingTask && !o && setNewTaskBucketId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Title *</Label>
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submitNewTask()}
              placeholder="Görev başlığı…"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setNewTaskBucketId(null)} disabled={creatingTask}>Vazgeç</Button>
            <Button type="button" disabled={creatingTask || !newTaskTitle.trim()} onClick={() => void submitNewTask()}>
              {creatingTask ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Bucket dialog */}
      <Dialog open={newBucketOpen} onOpenChange={(o) => !creatingBucket && setNewBucketOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Bucket</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Bucket Name *</Label>
            <Input value={newBucketName} onChange={(e) => setNewBucketName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submitNewBucket()} placeholder="örn. Aircraft Documentation" autoFocus />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setNewBucketOpen(false)} disabled={creatingBucket}>Vazgeç</Button>
            <Button type="button" disabled={creatingBucket || !newBucketName.trim()} onClick={() => void submitNewBucket()}>
              {creatingBucket ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bucket confirm */}
      <Dialog open={!!deleteBucketTarget} onOpenChange={(o) => !deletingBucket && !o && setDeleteBucketTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Bucket silinsin mi?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            &quot;{deleteBucketTarget?.name}&quot; silinecek. İçinde aktif görev varsa bu işlem reddedilir.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteBucketTarget(null)} disabled={deletingBucket}>Vazgeç</Button>
            <Button type="button" variant="destructive" disabled={deletingBucket} onClick={() => void confirmDeleteBucket()}>
              {deletingBucket ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-[11px]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function BucketColumn({
  bucket,
  tasks,
  canManage,
  onAddTask,
  onDeleteBucket,
  onOpenTask,
}: {
  bucket: BucketRow
  tasks: TaskRow[]
  canManage: boolean
  onAddTask: () => void
  onDeleteBucket: () => void
  onOpenTask: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket-${bucket.id}` })

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-1 border-b px-3 py-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{bucket.name}</h3>
        <span className="text-muted-foreground text-xs">{tasks.length}</span>
        {canManage && (
          <button type="button" onClick={onDeleteBucket} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Bucket'ı sil">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto p-2", isOver && "bg-primary/5")}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
          ))}
        </SortableContext>
      </div>
      <div className="border-t p-1.5">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground w-full justify-start" onClick={onAddTask}>
          <Plus className="mr-1.5 size-3.5" />
          Add Task
        </Button>
      </div>
    </div>
  )
}

function TaskCard({ task, onOpen }: { task: TaskRow; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const due = dueStatus(task.dueDate, task.status)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        "bg-card hover:border-primary/40 cursor-pointer space-y-1.5 rounded-md border p-2.5 text-sm shadow-sm transition-colors",
        due && DUE_STYLES[due].cardCls
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 leading-snug font-medium">{task.title}</p>
        {task.recurrenceRule && <Repeat className="mt-0.5 size-3.5 shrink-0 text-violet-500" />}
      </div>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span key={l} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">{l}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Medium)}>{task.priority}</span>
        {due && (
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", DUE_STYLES[due].cls)}>
            <Clock className="mr-0.5 inline size-2.5" />
            {DUE_STYLES[due].label}
          </span>
        )}
        {task.status === "Completed" && (
          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="size-2.5" />
            Done
          </span>
        )}
      </div>

      {(task.assignees.length > 0 || task.departments.length > 0) && (
        <p className="text-muted-foreground truncate text-[11px]">
          {[...task.assignees.map((a) => a.name), ...task.departments.map((d) => `${d} (Group)`)].join(", ")}
        </p>
      )}

      <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
        {task.checklistTotal > 0 && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {task.commentCount}
          </span>
        )}
        {task.attachmentCount > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="size-3" />
            {task.attachmentCount}
          </span>
        )}
      </div>
    </div>
  )
}

function TaskCardPreview({ task }: { task: TaskRow | null }) {
  if (!task) return null
  return (
    <div className="bg-card w-72 rounded-md border p-2.5 text-sm shadow-lg">
      <p className="font-medium">{task.title}</p>
    </div>
  )
}
