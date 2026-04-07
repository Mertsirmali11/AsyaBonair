"use client"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Plus,
  Calendar,
  AlertTriangle,
  Cake,
  Trash2,
  ArrowRight,
  ClipboardList,
} from "lucide-react"
import { formatDateOnlyIstanbul, formatDateTimeIstanbul } from "@/lib/date-format"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type DashboardUser = {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

interface Announcement {
  id: number
  title: string
  content: string
  createdAt: string
  creator: { isim: string | null; soyisim: string | null; departman: string | null } | null
  acknowledgedByMe?: boolean
}

interface Meeting {
  id: number
  meetingNo: string
  title: string
  plannedDate: string
  status: string
  meetingType: { name: string } | null
}

interface HazardReport {
  id: number
  reportNo: string | null
  title: string | null
  eventDate: string
  createdAt: string
  sourceType: string | null
}

interface Birthday {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  dogumTarihi: string | null
}

interface DashboardTask {
  id: number
  title: string
  dueDate: string | null
  status: string
  meeting: { id: number; meetingNo: string; title: string }
  assignee: { isim: string | null; soyisim: string | null } | null
}

const SUMMARY_RETRIES = 3
const SUMMARY_RETRY_MS = 400

export function DashboardHome({ user }: { user: DashboardUser }) {
  const pathname = usePathname()
  const hasLoadedOnceRef = useRef(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([])
  const [todayHazards, setTodayHazards] = useState<HazardReport[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [tasksDueToday, setTasksDueToday] = useState<DashboardTask[]>([])
  const [tasksDueNext30Days, setTasksDueNext30Days] = useState<DashboardTask[]>(
    []
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canAnnounce = user.departman === "Quality" || user.departman === "Human Resources"

  const fetchAll = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const silent = mode === "refresh" && hasLoadedOnceRef.current

    if (!silent) {
      setLoadError(null)
      setLoading(true)
    }

    let lastMsg = "Could not load data."
    for (let attempt = 0; attempt < SUMMARY_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          setAnnouncements(data.announcements ?? [])
          setTodayMeetings(data.todayMeetings ?? [])
          setTodayHazards(data.todayHazards ?? [])
          setBirthdays(data.birthdays ?? [])
          setTasksDueToday(data.tasksDueToday ?? [])
          setTasksDueNext30Days(data.tasksDueNext30Days ?? [])
          setLoadError(null)
          hasLoadedOnceRef.current = true
          setLoading(false)
          return
        }
        lastMsg =
          res.status >= 500
            ? "The server did not respond. Please try again shortly."
            : "Could not load dashboard summary."
        await new Promise((r) => setTimeout(r, SUMMARY_RETRY_MS * (attempt + 1)))
      } catch {
        lastMsg = "Connection lost or request timed out."
        await new Promise((r) => setTimeout(r, SUMMARY_RETRY_MS * (attempt + 1)))
      }
    }

    setLoadError(lastMsg)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchAll("initial")
  }, [fetchAll, pathname])

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void fetchAll("refresh")
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [fetchAll])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (!loadError) return
      void fetchAll("refresh")
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [fetchAll, loadError])

  const handleAnnounce = async () => {
    if (!title || !content) return
    setSaving(true)
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    })
    setSaving(false)
    setOpen(false)
    setTitle(""); setContent("")
    void fetchAll("refresh")
  }

  const handleAckAnnouncement = async (id: number) => {
    setAckingId(id)
    try {
      const res = await fetch(`/api/announcements/${id}/ack`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Could not save acknowledgment.")
        return
      }
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, acknowledgedByMe: true } : a
        )
      )
    } finally {
      setAckingId(null)
    }
  }

  const handleDeleteAnnouncement = async (id: number) => {
    if (
      !confirm(
        "Remove this announcement from the dashboard? Emails already sent cannot be recalled."
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Could not delete announcement")
        return
      }
      await fetchAll("refresh")
    } finally {
      setDeletingId(null)
    }
  }

  const canOpenMeetingsPage = user.departman === "Quality"

  const meetingTasksTableRows = useMemo(() => {
    const today = tasksDueToday.map((t) => ({ ...t, bucket: "today" as const }))
    const soon = tasksDueNext30Days.map((t) => ({ ...t, bucket: "soon" as const }))
    return [...today, ...soon].sort((a, b) => {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0
      return ta - tb
    })
  }, [tasksDueToday, tasksDueNext30Days])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
        {loadError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{loadError}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-600/40 bg-card/90 dark:bg-background"
              onClick={() => void fetchAll("initial")}
            >
              Retry
            </Button>
          </div>
        )}
        {loading && !loadError && (
          <p className="text-muted-foreground text-sm">Loading summary…</p>
        )}
        {todayMeetings.length > 0 && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">
                You have {todayMeetings.length} meeting{todayMeetings.length === 1 ? "" : "s"} scheduled today.
              </p>
              {canOpenMeetingsPage ? (
                <Link
                  href="/meetings"
                  className="inline-flex items-center gap-1 font-semibold text-sky-800 underline-offset-4 hover:underline dark:text-sky-200"
                >
                  Go to meetings
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  href={`/meetings/${todayMeetings[0].id}`}
                  className="inline-flex items-center gap-1 font-semibold text-sky-800 underline-offset-4 hover:underline dark:text-sky-200"
                >
                  Open meeting
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h2 className="text-lg font-bold">Announcements</h2>
              </div>
              {canAnnounce && (
                <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
                  <Plus size={14} /> New announcement
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
              {loading && !loadError && announcements.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Loading announcements…
                </div>
              ) : !loading && !loadError && announcements.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  No announcements yet.
                </div>
              ) : announcements.map(a => (
                <div key={a.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateOnlyIstanbul(a.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.content}</p>
                  {a.creator && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      — {a.creator.isim} {a.creator.soyisim} ({a.creator.departman})
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.acknowledgedByMe ? (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                          I have read and understood (acknowledged)
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-8"
                          disabled={ackingId === a.id}
                          onClick={() => void handleAckAnnouncement(a.id)}
                        >
                          {ackingId === a.id ? "Saving…" : "I have read and understood"}
                        </Button>
                      )}
                    </div>
                    {canAnnounce && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === a.id}
                        onClick={() => handleDeleteAnnouncement(a.id)}
                      >
                        <Trash2 className="size-3.5" />
                        {deletingId === a.id ? "Deleting…" : "Delete"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={18} className="text-indigo-600" />
                  <h2 className="text-lg font-bold">Task and actions</h2>
                </div>
                {canOpenMeetingsPage ? (
                  <Link
                    href="/meetings"
                    className="text-xs font-semibold text-indigo-700 underline-offset-4 hover:underline"
                  >
                    Meetings &amp; tasks
                  </Link>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Open action items: due <strong>today</strong> or within the{" "}
                <strong>next 30 days</strong> (Istanbul calendar). Completed tasks
                are hidden.
              </p>
              <div className="border rounded-lg bg-white overflow-hidden max-h-[min(420px,55vh)] overflow-y-auto">
                {meetingTasksTableRows.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No open tasks in this window.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[100px]">Window</TableHead>
                        <TableHead className="min-w-[140px]">Task</TableHead>
                        <TableHead className="min-w-[120px] hidden sm:table-cell">
                          Meeting
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Assignee
                        </TableHead>
                        <TableHead>Due (IST)</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetingTasksTableRows.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="align-top">
                            <span
                              className={
                                t.bucket === "today"
                                  ? "inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-900"
                                  : "inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900"
                              }
                            >
                              {t.bucket === "today" ? "Today" : "30 days"}
                            </span>
                          </TableCell>
                          <TableCell className="align-top max-w-[200px] whitespace-normal">
                            <Link
                              href={`/meetings/${t.meeting.id}`}
                              className="font-medium text-indigo-800 hover:underline"
                            >
                              {t.title}
                            </Link>
                          </TableCell>
                          <TableCell className="align-top text-muted-foreground text-xs whitespace-normal hidden sm:table-cell max-w-[180px]">
                            {t.meeting.meetingNo}
                            <span className="text-gray-400"> · </span>
                            {t.meeting.title}
                          </TableCell>
                          <TableCell className="align-top text-xs hidden md:table-cell">
                            {t.assignee
                              ? `${t.assignee.isim ?? ""} ${t.assignee.soyisim ?? ""}`.trim() ||
                                "—"
                              : "—"}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {t.dueDate
                              ? formatDateOnlyIstanbul(t.dueDate)
                              : "—"}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {t.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-green-600" />
                <h2 className="text-lg font-bold">Today&apos;s meetings</h2>
              </div>
              <div className="flex flex-col gap-2">
                {todayMeetings.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
                    No meetings scheduled for today.
                  </div>
                ) : todayMeetings.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.meetingType?.name ?? "—"} · {m.meetingNo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateOnlyIstanbul(m.plannedDate)} (Istanbul)
                      </p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${m.status === "Completed" ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" : "bg-secondary text-secondary-foreground"}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-lg font-bold">Today&apos;s hazard reports</h2>
              </div>
              <div className="flex flex-col gap-2">
                {todayHazards.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
                    No hazard reports for today.
                  </div>
                ) : todayHazards.map(h => (
                  <div key={h.id} className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium">{h.title ?? "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">{h.reportNo} · {h.sourceType}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Reported {formatDateTimeIstanbul(h.createdAt)} (Istanbul)
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cake size={18} className="text-pink-500" />
                <h2 className="text-lg font-bold">Birthdays today 🎂</h2>
              </div>
              <div className="flex flex-col gap-2">
                {birthdays.length === 0 ? (
                  <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
                    No birthdays today.
                  </div>
                ) : birthdays.map(b => (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg border border-pink-200/60 bg-pink-50/80 p-3 dark:border-pink-900/40 dark:bg-pink-950/25">
                    <span className="text-2xl">🎂</span>
                    <div>
                      <p className="font-medium text-sm">{b.isim} {b.soyisim}</p>
                      <p className="text-xs text-muted-foreground">{b.departman}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" className="mt-1" />
            </div>
            <div>
              <Label>Content <span className="text-red-500">*</span></Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Announcement body..." className="mt-1 min-h-32" />
            </div>
            <Button
              onClick={handleAnnounce}
              disabled={saving || !title || !content}
            >
              {saving ? "Sending..." : "Publish and email staff"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
