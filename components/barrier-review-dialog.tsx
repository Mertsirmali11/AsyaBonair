"use client"

import { useMemo } from "react"
import {
  CircleDot,
  Clock,
  Info,
  Plug,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { BarrierRecordStatusLabel } from "@/lib/meeting-task-title-match"
import { cn } from "@/lib/utils"

export type BarrierReviewHistoryEntry = {
  id: string
  date: string
  message: string
  actor: string
}

export type BarrierReviewRecord = {
  taskName: string
  source: string
  recordDate: string
  responsible: string
  dueDate: string
  statusLabel: BarrierRecordStatusLabel
  linkedTaskId: number | null
  linkedMeetingId: number | null
  riskTitle: string
}

function statusBadgeClass(label: BarrierRecordStatusLabel) {
  switch (label) {
    case "Current":
      return "border-0 bg-emerald-600 text-white hover:bg-emerald-600"
    case "In Progress":
      return "border-0 bg-sky-600 text-white hover:bg-sky-600"
    default:
      return "border-0 bg-violet-600 text-white hover:bg-violet-600"
  }
}

export function BarrierReviewDialog({
  open,
  onOpenChange,
  record,
  historyEntries,
  onOpenLinkedTask,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: BarrierReviewRecord | null
  historyEntries: BarrierReviewHistoryEntry[]
  /** If meetingId is set, open meeting with task highlight; otherwise parent opens task UI. */
  onOpenLinkedTask: (taskId: number, meetingId: number | null) => void
}) {
  const filteredHistory = useMemo(() => {
    if (!record) return []
    const needle = record.taskName.trim()
    if (needle.length >= 3) {
      const hit = historyEntries.filter((e) => e.message.includes(needle))
      if (hit.length > 0) return hit.slice(-25)
    }
    return historyEntries.slice(-15)
  }, [historyEntries, record])

  if (!record) return null

  const canOpenTask =
    record.linkedTaskId != null && record.linkedTaskId > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90dvh,720px)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <DialogHeader className="relative space-y-3 border-b border-border px-6 pb-4 pt-6 text-left">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 size-8 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
          <DialogTitle className="pr-10 text-lg font-semibold leading-snug">
            Review &quot;{record.taskName}&quot;
          </DialogTitle>
          <div>
            <Badge
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-medium",
                statusBadgeClass(record.statusLabel)
              )}
            >
              {record.statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-0 px-6 py-4">
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Action Page
            </h3>
            <button
              type="button"
              disabled={!canOpenTask}
              onClick={() => {
                if (!canOpenTask) return
                onOpenLinkedTask(record.linkedTaskId!, record.linkedMeetingId)
                onOpenChange(false)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-transparent px-1 py-1 text-left text-sm font-medium transition-colors",
                canOpenTask
                  ? "text-emerald-600 hover:bg-emerald-500/10 hover:underline dark:text-emerald-400"
                  : "cursor-not-allowed text-muted-foreground opacity-70"
              )}
            >
              <Plug className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{record.taskName}</span>
            </button>
            {!canOpenTask && (
              <p className="text-muted-foreground text-xs">
                This barrier is not linked to a task. Add a barrier using “Connect
                to an existing task” or “Create a new task”, or ensure an older
                barrier title still matches a task.
              </p>
            )}
          </section>

          <Separator className="my-4" />

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Related Risk
            </h3>
            <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
              <CircleDot className="size-4 shrink-0" />
              <span>
                {record.riskTitle}{" "}
                <span className="text-muted-foreground font-normal">(Risk)</span>
              </span>
            </div>
          </section>

          <Separator className="my-4" />

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Record Summary
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Source</dt>
              <dd className="font-medium">{record.source}</dd>
              <dt className="text-muted-foreground">Record date</dt>
              <dd className="tabular-nums">{record.recordDate}</dd>
              <dt className="text-muted-foreground">Responsible</dt>
              <dd>{record.responsible}</dd>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="tabular-nums">{record.dueDate}</dd>
            </dl>
          </section>

          <Separator className="my-4" />

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Uploaded Files
            </h3>
            <div className="flex items-start gap-2 rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              <Info className="mt-0.5 size-4 shrink-0 opacity-80" />
              <span>
                Task files are managed from the meeting task screen. No local file
                is attached to this barrier record yet.
              </span>
            </div>
          </section>

          <Separator className="my-4" />

          <section className="rounded-lg border border-border bg-muted/40 p-3 dark:bg-muted/20">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              History
            </div>
            {filteredHistory.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No history lines matched this barrier.
              </p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto text-xs leading-snug text-foreground">
                {filteredHistory.map((e) => (
                  <li key={e.id}>
                    <span className="text-muted-foreground tabular-nums">
                      {e.date}
                    </span>
                    {" — "}
                    {e.message}
                    <span className="text-muted-foreground"> · {e.actor}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
