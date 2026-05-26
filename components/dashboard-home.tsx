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
  Ticket,
  BookOpen,
} from "lucide-react"
import { formatDateOnlyIstanbul, formatDateTimeIstanbul } from "@/lib/date-format"
import { isAdminDepartment } from "@/lib/department-access"
import { canViewAllMeetingTasks } from "@/lib/meeting-task-access"
import { useLanguage } from "@/lib/i18n/context"
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

interface CertificateExpiredAlert {
  id: number
  docType: string
  fileName: string
  validUntil: string
  daysExpired: number
  aircraft: { id: number; register: string; msn: string }
}

interface SupportTicketPreview {
  id: number
  subject: string | null
  content: string
  status: string
  createdAt: string
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
    departman: string | null
  }
}

function supportPersonelLabel(c: SupportTicketPreview["creator"]): string {
  const n = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  return n || c.email
}

function supportTruncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

const SUMMARY_RETRIES = 3
const SUMMARY_RETRY_MS = 400
/** Duyuru gövdesi kaydırmasında “sona gelindi” toleransı (px) */
const ANNOUNCEMENT_SCROLL_END_PX = 16

export function DashboardHome({ user }: { user: DashboardUser }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const d = t.dashboard
  const hasLoadedOnceRef = useRef(false)

  /** Support ticket status label lookup */
  const supportStatusLabel = (status: string): string => {
    switch (status) {
      case "OPEN":        return d.statusOpen
      case "IN_PROGRESS": return d.statusInProgress
      case "RESOLVED":    return d.statusResolved
      case "CLOSED":      return d.statusClosed
      default:            return status
    }
  }

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([])
  const [todayHazards, setTodayHazards] = useState<HazardReport[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [tasksDueToday, setTasksDueToday] = useState<DashboardTask[]>([])
  const [tasksDueNext30Days, setTasksDueNext30Days] = useState<DashboardTask[]>(
    []
  )
  const [tasksOverdue, setTasksOverdue] = useState<DashboardTask[]>([])
  const [tasksNoDueDate, setTasksNoDueDate] = useState<DashboardTask[]>([])
  const [certificatesExpiringSoon, setCertificatesExpiringSoon] = useState<
    CertificateExpiryAlert[]
  >([])
  const [certificatesExpired, setCertificatesExpired] = useState<
    CertificateExpiredAlert[]
  >([])
  const [supportTicketsPreview, setSupportTicketsPreview] = useState<
    SupportTicketPreview[]
  >([])
  const [supportTicketsAdminView, setSupportTicketsAdminView] =
    useState(false)
  const [pendingManualsCount, setPendingManualsCount] = useState(0)
  const [pendingFormsCount, setPendingFormsCount] = useState(0)
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

  const canAnnounce =
    user.departman === "Quality" ||
    user.departman === "Human Resources" ||
    isAdminDepartment(user.departman)

  const showAllMeetingTasks = canViewAllMeetingTasks(user.departman)

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
          setTasksOverdue(data.tasksOverdue ?? [])
          setTasksNoDueDate(data.tasksNoDueDate ?? [])
          setCertificatesExpiringSoon(data.certificatesExpiringSoon ?? [])
          setCertificatesExpired(data.certificatesExpired ?? [])
          setSupportTicketsPreview(data.supportTicketsPreview ?? [])
          setSupportTicketsAdminView(!!data.supportTicketsAdminView)
          setPendingManualsCount(data.pendingManualsCount ?? 0)
          setPendingFormsCount(data.pendingFormsCount ?? 0)
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

  const canOpenMeetingsPage =
    user.departman === "Quality" || isAdminDepartment(user.departman)

  const meetingTasksTableRows = useMemo(() => {
    const overdue = tasksOverdue.map((t) => ({ ...t, bucket: "overdue" as const }))
    const today = tasksDueToday.map((t) => ({ ...t, bucket: "today" as const }))
    const soon = tasksDueNext30Days.map((t) => ({ ...t, bucket: "soon" as const }))
    const noDue = tasksNoDueDate.map((t) => ({ ...t, bucket: "noDue" as const }))
    return [...overdue, ...today, ...soon, ...noDue].sort((a, b) => {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
  }, [tasksDueToday, tasksDueNext30Days, tasksOverdue, tasksNoDueDate])

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
        {(certificatesExpiringSoon.length > 0 ||
          certificatesExpired.length > 0 ||
          (!loading && !loadError)) && (
          <div
            className={
              (certificatesExpiringSoon.length > 0 ||
                certificatesExpired.length > 0) &&
              !loading &&
              !loadError
                ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start"
                : "flex flex-col gap-4"
            }
          >
            {(certificatesExpired.length > 0 ||
              certificatesExpiringSoon.length > 0) &&
              !loading &&
              !loadError && (
                <div className="flex flex-col gap-3">
                  {certificatesExpired.length > 0 && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-300/90 bg-red-50 px-3 py-2.5 text-sm text-red-950 shadow-sm dark:border-red-800/55 dark:bg-red-950/40 dark:text-red-50"
                    >
                      <div className="flex min-w-0 gap-2">
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight text-red-950 dark:text-red-100">
                            {d.expiredCerts}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-red-900/85 dark:text-red-200/90">
                            {d.expiredCertsDesc}
                          </p>
                        </div>
                      </div>
                      <ul className="mt-2 max-h-[min(28vh,200px)] space-y-1.5 overflow-y-auto overscroll-contain border-t border-red-200/80 pt-2 pr-0.5 dark:border-red-800/60">
                        {certificatesExpired.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/documents/aircraft-settings/${c.aircraft.id}`}
                                className="font-medium text-red-950 underline-offset-4 hover:underline dark:text-red-100"
                              >
                                {c.aircraft.register}
                              </Link>
                              <span className="text-muted-foreground"> — </span>
                              <span className="text-red-950/95 dark:text-red-100/95">
                                {c.docType}
                              </span>
                              <span className="block truncate text-xs text-red-900/80 dark:text-red-200/85">
                                {c.fileName}
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
                              <span>
                                {d.validUntil}:{" "}
                                <span className="font-medium">
                                  {formatDateOnlyIstanbul(c.validUntil)}
                                </span>
                              </span>
                              <span className="font-semibold text-red-800 dark:text-red-300">
                                {c.daysExpired === 0
                                  ? d.certExpired
                                  : `${c.daysExpired} ${d.daysOverdue}`}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {certificatesExpiringSoon.length > 0 && (
                    <div
                      role="status"
                      className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-2">
                          <FileWarning
                            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight text-amber-950 dark:text-amber-100">
                              {d.expiringSoonCerts}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-amber-900/85 dark:text-amber-200/90">
                              {d.expiringSoonDesc}
                            </p>
                          </div>
                        </div>
                      </div>
                      <ul className="mt-2 max-h-[min(28vh,200px)] space-y-1.5 overflow-y-auto overscroll-contain border-t border-amber-200/80 pt-2 pr-0.5 dark:border-amber-800/60">
                        {certificatesExpiringSoon.map((c) => (
                          <li
                            key={c.id}
                            className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3"
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
                            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
                              <span>
                                {d.validUntil}:{" "}
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
                                  ? d.lastDayToday
                                  : `${c.daysRemaining} ${d.daysLeft}`}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            {!loading && !loadError && pendingManualsCount > 0 && (
              <div className="rounded-lg border border-amber-300/90 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-2">
                    <BookOpen
                      className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-amber-950 dark:text-amber-100">
                        Onay Bekleyen Manuel Yüklemesi ({pendingManualsCount})
                      </p>
                      <p className="mt-0.5 text-xs text-amber-900/85 dark:text-amber-200/90">
                        {pendingManualsCount} adet manuel yükleme talebiniz onayınızı bekliyor.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/documents"
                    className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-semibold text-amber-800 underline-offset-4 hover:underline dark:text-amber-200 sm:self-center"
                  >
                    Manueller
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            )}

            {!loading && !loadError && pendingFormsCount > 0 && (
              <div className="rounded-lg border border-amber-300/90 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-2">
                    <BookOpen
                      className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-amber-950 dark:text-amber-100">
                        Onay Bekleyen Form Yüklemesi ({pendingFormsCount})
                      </p>
                      <p className="mt-0.5 text-xs text-amber-900/85 dark:text-amber-200/90">
                        {pendingFormsCount} adet form yükleme talebiniz onayınızı bekliyor.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/documents/forms"
                    className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-semibold text-amber-800 underline-offset-4 hover:underline dark:text-amber-200 sm:self-center"
                  >
                    Formlar
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            )}

            {!loading && !loadError && (
              <div className="rounded-lg border border-violet-200/90 bg-violet-50/95 px-3 py-2.5 text-sm text-violet-950 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/35 dark:text-violet-100">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-2">
                    <Ticket
                      className="mt-0.5 size-4 shrink-0 text-violet-700 dark:text-violet-300"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-violet-950 dark:text-violet-50">
                        {supportTicketsAdminView ? d.incomingTickets : d.myTickets}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-violet-900/85 dark:text-violet-200/90">
                        {supportTicketsAdminView ? d.incomingTicketsDesc : d.myTicketsDesc}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/support-tickets"
                    className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-semibold text-violet-800 underline-offset-4 hover:underline dark:text-violet-200 sm:self-center"
                  >
                    Support Ticket
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                {supportTicketsPreview.length === 0 ? (
                  <p className="mt-2 border-t border-violet-200/80 pt-2 text-xs text-violet-800/90 dark:border-violet-800/50 dark:text-violet-200/85">
                    {supportTicketsAdminView ? d.noIncomingTickets : d.noMyTickets}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-[min(36vh,280px)] space-y-1.5 overflow-y-auto overscroll-contain border-t border-violet-200/80 pt-2 pr-0.5 dark:border-violet-800/50">
                    {supportTicketsPreview.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-col gap-0.5 rounded-md border border-violet-200/60 bg-white/80 px-2.5 py-1.5 dark:border-violet-900/50 dark:bg-violet-950/30"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium leading-snug text-violet-950 dark:text-violet-50">
                            {t.subject?.trim()
                              ? t.subject
                              : supportTruncate(t.content, 56)}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                            {supportStatusLabel(t.status)}
                          </span>
                        </div>
                        {supportTicketsAdminView ? (
                          <p className="text-[11px] text-violet-800/90 dark:text-violet-200/85">
                            {supportPersonelLabel(t.creator)}
                            {t.creator.departman ? (
                              <span className="text-violet-700/80">
                                {" "}
                                · {t.creator.departman}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        <p className="line-clamp-2 text-[11px] text-violet-900/80 dark:text-violet-200/80">
                          {supportTruncate(t.content, 120)}
                        </p>
                        <p className="text-[10px] tabular-nums text-violet-700/85 dark:text-violet-300/90">
                          {formatDateTimeIstanbul(t.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                <h2 className="text-lg font-bold">{d.announcements}</h2>
              </div>
              {canAnnounce && (
                <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
                  <Plus size={14} /> {d.newAnnouncement}
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
              {loading && !loadError && announcements.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  {d.loadingAnnouncements}
                </div>
              ) : !loading && !loadError && announcements.length === 0 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                  {d.noAnnouncements}
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
                            aria-label={d.announcements}
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
                            {ackScrollReady[a.id] ? d.readyToAck : d.scrollToRead}
                          </p>
                        ) : (
                          <p className="mb-2 text-xs text-muted-foreground">
                            {d.alreadyAcked}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {a.acknowledgedByMe ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                {d.ackedLabel}
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
                                    : d.scrollHint
                                }
                                disabled={
                                  ackingId === a.id || !ackScrollReady[a.id]
                                }
                                onClick={() =>
                                  void handleAckAnnouncement(a.id)
                                }
                              >
                                {ackingId === a.id ? d.saving : d.ackLabel}
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
                              {deletingId === a.id ? d.deleting : t.common.delete}
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
                Open action items (overdue, today, upcoming, or no due date).
                Completed tasks are hidden.{" "}
                {showAllMeetingTasks
                  ? "As an admin you see tasks for all assignees."
                  : "You only see tasks assigned to you."}
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
                        {showAllMeetingTasks ? (
                          <TableHead className="hidden md:table-cell">
                            Assignee
                          </TableHead>
                        ) : null}
                        <TableHead>Due (IST)</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meetingTasksTableRows.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="align-top">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                t.bucket === "today" && "bg-indigo-100 text-indigo-900",
                                t.bucket === "soon" && "bg-violet-100 text-violet-900",
                                t.bucket === "overdue" && "bg-red-100 text-red-900",
                                t.bucket === "noDue" && "bg-slate-100 text-slate-700"
                              )}
                            >
                              {t.bucket === "today"
                                ? "Today"
                                : t.bucket === "soon"
                                  ? "Upcoming"
                                  : t.bucket === "overdue"
                                    ? "Overdue"
                                    : "No date"}
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
                          {showAllMeetingTasks ? (
                            <TableCell className="align-top text-xs hidden md:table-cell">
                              {t.assignee
                                ? `${t.assignee.isim ?? ""} ${t.assignee.soyisim ?? ""}`.trim() ||
                                  "—"
                                : "—"}
                            </TableCell>
                          ) : null}
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
            <DialogTitle>{d.newAnnouncement}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>{d.announcementTitle} <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={d.announcementTitlePlaceholder} className="mt-1" />
            </div>
            <div>
              <Label>{d.announcementContent} <span className="text-red-500">*</span></Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder={d.announcementContentPlaceholder} className="mt-1 min-h-32" />
            </div>
            <Button
              onClick={handleAnnounce}
              disabled={saving || !title || !content}
            >
              {saving ? d.publishingAnnouncement : d.publishAnnouncement}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
