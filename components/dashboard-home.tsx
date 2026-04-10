"use client"
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
} from "react"
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
  FileWarning,
  ChevronDown,
} from "lucide-react"
import { formatDateOnlyIstanbul, formatDateTimeIstanbul } from "@/lib/date-format"
import { cn } from "@/lib/utils"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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
  meeting: { id: number; meetingNo: string; title: string } | null
  assignee: { isim: string | null; soyisim: string | null } | null
}

interface CertificateExpiryAlert {
  id: number
  docType: string
  fileName: string
  validUntil: string
  daysRemaining: number
  aircraft: { id: number; register: string; msn: string }
}

const SUMMARY_RETRIES = 3
const SUMMARY_RETRY_MS = 400
/** Duyuru gövdesi kaydırmasında “sona gelindi” toleransı (px) */
const ANNOUNCEMENT_SCROLL_END_PX = 16

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
  const [certificatesExpiringSoon, setCertificatesExpiringSoon] = useState<
    CertificateExpiryAlert[]
  >([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [openAnnouncementId, setOpenAnnouncementId] = useState<number | null>(
    null
  )
  /** Metin alanı sonuna gelinmeden onay yok (id → hazır) */
  const [ackScrollReady, setAckScrollReady] = useState<Record<number, boolean>>(
    {}
  )
  const announcementScrollBodyRef = useRef<HTMLDivElement | null>(null)
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
          setCertificatesExpiringSoon(data.certificatesExpiringSoon ?? [])
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

  const updateAckReadinessFromEl = useCallback(
    (id: number, el: HTMLDivElement | null) => {
      if (!el) return
      const t = ANNOUNCEMENT_SCROLL_END_PX
      const { scrollTop, scrollHeight, clientHeight } = el
      const fitsEntirely = scrollHeight <= clientHeight + t
      const atBottom = scrollTop + clientHeight >= scrollHeight - t
      const ready = fitsEntirely || atBottom
      setAckScrollReady((prev) =>
        prev[id] === ready ? prev : { ...prev, [id]: ready }
      )
    },
    []
  )

  useLayoutEffect(() => {
    if (openAnnouncementId == null) return
    const id = openAnnouncementId
    setAckScrollReady((prev) => ({ ...prev, [id]: false }))
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      const el = announcementScrollBodyRef.current
      if (el) updateAckReadinessFromEl(id, el)
    }
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(measure)
    })
    const timeoutId = window.setTimeout(measure, 100)
    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
      window.clearTimeout(timeoutId)
    }
  }, [openAnnouncementId, announcements, updateAckReadinessFromEl])

  useLayoutEffect(() => {
    if (openAnnouncementId == null) return
    const el = announcementScrollBodyRef.current
    if (!el) return
    const id = openAnnouncementId
    const ro = new ResizeObserver(() => updateAckReadinessFromEl(id, el))
    ro.observe(el)
    return () => ro.disconnect()
  }, [openAnnouncementId, announcements, updateAckReadinessFromEl])

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
        {certificatesExpiringSoon.length > 0 && (
          <div
            role="status"
            className="rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-2">
                <FileWarning
                  className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    Süresi dolmak üzere olan uçak sertifikaları
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900/85 dark:text-amber-200/90">
                    Geçerlilik bitiş tarihi bugünden itibaren 30 gün veya daha az
                    kalan sertifikalar (Controlled Documents → Aircraft).
                  </p>
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-2 border-t border-amber-200/80 pt-3 dark:border-amber-800/60">
              {certificatesExpiringSoon.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/documents/aircraft-settings/${c.aircraft.id}`}
                      className="font-medium text-amber-950 underline-offset-4 hover:underline dark:text-amber-100"
                    >
                      {c.aircraft.register}
                    </Link>
                    <span className="text-muted-foreground"> — </span>
                    <span className="text-amber-950/95 dark:text-amber-100/95">
                      {c.docType}
                    </span>
                    <span className="block truncate text-xs text-amber-900/80 dark:text-amber-200/80">
                      {c.fileName}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums">
                    <span>
                      Bitiş:{" "}
                      <span className="font-medium">
                        {formatDateOnlyIstanbul(c.validUntil)}
                      </span>
                    </span>
                    <span
                      className={
                        c.daysRemaining <= 7
                          ? "font-semibold text-red-700 dark:text-red-400"
                          : "font-medium text-amber-900 dark:text-amber-300"
                      }
                    >
                      {c.daysRemaining === 0
                        ? "Bugün son gün"
                        : `${c.daysRemaining} gün kaldı`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
              ) : announcements.map((a) => {
                const expanded = openAnnouncementId === a.id
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border bg-card"
                  >
                    <Collapsible
                      open={expanded}
                      onOpenChange={(open) =>
                        setOpenAnnouncementId(open ? a.id : null)
                      }
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/45"
                        >
                          <h3 className="min-w-0 flex-1 font-semibold text-sm leading-snug">
                            {a.title}
                          </h3>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDateOnlyIstanbul(a.createdAt)}
                            </span>
                            <ChevronDown
                              className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                expanded && "rotate-180"
                              )}
                              aria-hidden
                            />
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      {/* Body only inside Radix; ack bar below avoids CollapsibleContent clipping */}
                      <CollapsibleContent>
                        <div className="border-t border-border">
                          <div
                            ref={expanded ? announcementScrollBodyRef : undefined}
                            className="max-h-[min(320px,48dvh)] min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-3 [-webkit-overflow-scrolling:touch] [overflow-anchor:none]"
                            tabIndex={0}
                            aria-label="Duyuru metni"
                            onScroll={(e) =>
                              updateAckReadinessFromEl(a.id, e.currentTarget)
                            }
                            onWheel={(e) => {
                              const el = e.currentTarget
                              const { scrollTop, scrollHeight, clientHeight } = el
                              const delta = e.deltaY
                              const canScrollUp = scrollTop > 0
                              const canScrollDown =
                                scrollTop + clientHeight < scrollHeight - 1
                              if (
                                (delta < 0 && canScrollUp) ||
                                (delta > 0 && canScrollDown)
                              ) {
                                e.stopPropagation()
                              }
                            }}
                          >
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {a.content}
                            </p>
                            {a.creator && (
                              <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                                — {a.creator.isim} {a.creator.soyisim} (
                                {a.creator.departman})
                              </p>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    {expanded ? (
                      <div className="border-t border-border bg-muted/50 px-4 py-3 dark:bg-muted/40">
                        {!a.acknowledgedByMe ? (
                          <p
                            className={cn(
                              "mb-2 text-xs",
                              ackScrollReady[a.id]
                                ? "text-muted-foreground"
                                : "font-medium text-amber-800 dark:text-amber-200"
                            )}
                          >
                            {ackScrollReady[a.id]
                              ? "Metni inceledikten sonra onaylayabilirsiniz."
                              : "Önce duyurunun tamamını aşağı kaydırarak okuyun; ardından «Okudum, anladım» etkinleşir."}
                          </p>
                        ) : (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Bu duyuruyu onayladınız.
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {a.acknowledgedByMe ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Okudum, anladım (onaylandı)
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                className="h-8"
                                title={
                                  ackScrollReady[a.id]
                                    ? undefined
                                    : "Metnin tamamını görüntüleyin"
                                }
                                disabled={
                                  ackingId === a.id || !ackScrollReady[a.id]
                                }
                                onClick={() =>
                                  void handleAckAnnouncement(a.id)
                                }
                              >
                                {ackingId === a.id
                                  ? "Kaydediliyor…"
                                  : "Okudum, anladım"}
                              </Button>
                            )}
                          </div>
                          {canAnnounce && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingId === a.id}
                              onClick={() => handleDeleteAnnouncement(a.id)}
                            >
                              <Trash2 className="size-3.5" />
                              {deletingId === a.id ? "Siliniyor…" : "Sil"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
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
                            {t.meeting ? (
                              <Link
                                href={`/meetings/${t.meeting.id}`}
                                className="font-medium text-indigo-800 hover:underline"
                              >
                                {t.title}
                              </Link>
                            ) : (
                              <span className="font-medium text-foreground">{t.title}</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-muted-foreground text-xs whitespace-normal hidden sm:table-cell max-w-[180px]">
                            {t.meeting ? (
                              <>
                                {t.meeting.meetingNo}
                                <span className="text-gray-400"> · </span>
                                {t.meeting.title}
                              </>
                            ) : (
                              <span className="italic">No meeting</span>
                            )}
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
