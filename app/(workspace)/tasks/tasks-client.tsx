"use client"
import { useState, useEffect } from "react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, Circle, MoreVertical } from "lucide-react"
import { TaskManageDialog, TaskQuickViewDialog, type TaskRow } from "./task-dialogs"

interface Task extends TaskRow {
  createdAt?: string
}

async function fetchTasksFromApi(): Promise<Task[]> {
  const res = await fetch("/api/tasks")
  const text = await res.text()
  if (!text) return []
  try {
    const data = JSON.parse(text) as unknown
    if (!res.ok || !Array.isArray(data)) return []
    return data as Task[]
  } catch {
    return []
  }
}

const statusIcon = (s: string) => {
  if (s === "Completed") return <CheckCircle2 size={14} className="text-green-600" />
  if (s === "In Progress") return <Clock size={14} className="text-yellow-600" />
  return <Circle size={14} className="text-gray-400" />
}

export function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState("All")
  const [quickViewTask, setQuickViewTask] = useState<Task | null>(null)
  const [manageTaskId, setManageTaskId] = useState<number | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  const fetchTasks = async () => {
    try {
      setTasks(await fetchTasksFromApi())
    } catch {
      setTasks([])
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchTasksFromApi()
      .then((rows) => {
        if (!cancelled) setTasks(rows)
      })
      .catch(() => {
        if (!cancelled) setTasks([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateStatus = async (taskId: number, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    fetchTasks()
  }

  const openManage = (taskId: number) => {
    setManageTaskId(taskId)
    setManageOpen(true)
  }

  const filtered = filter === "All" ? tasks : tasks.filter(t => t.status === filter)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-2xl font-bold">Tasks & Actions</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12 px-2 text-center">
                <span className="sr-only">Actions</span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Meeting</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  No tasks found.
                </TableCell>
              </TableRow>
            ) : filtered.map(task => (
              <TableRow key={task.id}>
                <TableCell className="w-12 px-2 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label="Task actions"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={() => {
                          openManage(task.id)
                        }}
                      >
                        Manage
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setQuickViewTask(task)}
                      >
                        Quick view
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>{statusIcon(task.status)}</TableCell>
                <TableCell className="font-medium max-w-xs truncate">{task.title}</TableCell>
                <TableCell className="text-xs text-gray-500">
                  <span className="font-mono">{task.meeting.meetingNo}</span>
                  <br />{task.meeting.title}
                </TableCell>
                <TableCell>
                  {task.assignee ? `${task.assignee.isim} ${task.assignee.soyisim}` : "—"}
                </TableCell>
                <TableCell className={
                  task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Completed"
                    ? "text-red-500 font-semibold text-sm"
                    : "text-sm"
                }>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US") : "—"}
                </TableCell>
                <TableCell>
                  <Select value={task.status} onValueChange={v => updateStatus(task.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TaskQuickViewDialog
        task={quickViewTask}
        open={quickViewTask !== null}
        onOpenChange={(open) => {
          if (!open) setQuickViewTask(null)
        }}
      />

      <TaskManageDialog
        taskId={manageTaskId}
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open)
          if (!open) setManageTaskId(null)
        }}
        onUpdated={fetchTasks}
      />
    </div>
  )
}
