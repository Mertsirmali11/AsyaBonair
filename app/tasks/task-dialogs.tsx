"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TaskDetailPanel } from "@/app/(workspace)/tasks/task-detail-panel"

export type TaskRow = {
  id: number
  title: string
  status: string
  dueDate: string | null
  createdAt?: string
  assignee: { isim: string | null; soyisim: string | null } | null
  assignedDepartment?: string | null
  meeting: { id: number; meetingNo: string; title: string } | null
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
            <p>
              {task.assignee
                ? `${task.assignee.isim ?? ""} ${task.assignee.soyisim ?? ""}`.trim() || "Unknown"
                : task.assignedDepartment
                  ? `Dept: ${task.assignedDepartment}`
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Meeting</p>
            {task.meeting ? (
              <>
                <Link
                  href={`/meetings/${task.meeting.id}`}
                  className="text-primary font-mono text-xs underline-offset-4 hover:underline"
                >
                  {task.meeting.meetingNo}
                </Link>
                <p className="text-muted-foreground mt-0.5">{task.meeting.title}</p>
              </>
            ) : (
              <p className="text-muted-foreground mt-0.5 text-sm">Not linked to a meeting</p>
            )}
          </div>
          {task.meeting ? (
            <Button asChild className="w-full">
              <Link href={`/meetings/${task.meeting.id}`}>Open meeting</Link>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
  const [title] = useState<string>("Task management")

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
          <DialogTitle className="pr-10 text-base font-semibold sm:text-lg">{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 p-4 sm:p-6">
          <TaskDetailPanel
            taskId={taskId}
            onUpdated={onUpdated}
            className="h-full min-h-[70vh]"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
