"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Plus, Calendar, AlertTriangle, Cake, Trash2, ArrowRight } from "lucide-react"
import { formatDateOnlyIstanbul, formatDateTimeIstanbul } from "@/lib/date-format"
import { Button } from "@/components/ui/button"
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

const SUMMARY_RETRIES = 3
const SUMMARY_RETRY_MS = 400

export function DashboardHome({ user }: { user: DashboardUser }) {
  const pathname = usePathname()
  const hasLoadedOnceRef = useRef(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([])
  const [todayHazards, setTodayHazards] = useState<HazardReport[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canAnnounce = user.departman === "Quality" || user.departman === "Human Resources"

  const fetchAll = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const silent = mode === "refresh" && hasLoadedOnceRef.current

    if (!silent) {
      setLoadError(null)
      setLoading(true)
    }

    let lastMsg = "Veriler yüklenemedi."
    for (let attempt = 0; attempt < SUMMARY_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          setAnnouncements(data.announcements ?? [])
          setTodayMeetings(data.todayMeetings ?? [])
          setTodayHazards(data.todayHazards ?? [])
          setBirthdays(data.birthdays ?? [])
          setLoadError(null)
          hasLoadedOnceRef.current = true
          setLoading(false)
          return
        }
        lastMsg =
          res.status >= 500
            ? "Sunucu geçici olarak yanıt vermedi. Bir süre sonra tekrar deneyin."
            : "Özet verisi alınamadı."
        await new Promise((r) => setTimeout(r, SUMMARY_RETRY_MS * (attempt + 1)))
      } catch {
        lastMsg = "Bağlantı kesildi veya zaman aşımı oluştu."
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
              Yeniden dene
            </Button>
          </div>
        )}
        {loading && !loadError && (
          <p className="text-muted-foreground text-sm">Özet yükleniyor…</p>
        )}
        {todayMeetings.length > 0 && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">
                Bugün için {todayMeetings.length} toplantınız planlandı.
              </p>
              {canOpenMeetingsPage ? (
                <Link
                  href="/meetings"
                  className="inline-flex items-center gap-1 font-semibold text-sky-800 underline-offset-4 hover:underline dark:text-sky-200"
                >
                  Toplantı planlarına git
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  href={`/meetings/${todayMeetings[0].id}`}
                  className="inline-flex items-center gap-1 font-semibold text-sky-800 underline-offset-4 hover:underline dark:text-sky-200"
                >
                  Toplantı detayına git
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
                  Duyurular yükleniyor…
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
                  {canAnnounce && (
                    <div className="mt-3 flex justify-end border-t border-border pt-3">
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">

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
                        {formatDateOnlyIstanbul(m.plannedDate)} (İstanbul)
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
