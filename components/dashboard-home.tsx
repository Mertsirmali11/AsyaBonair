"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
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

export function DashboardHome({ user }: { user: DashboardUser }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([])
  const [todayHazards, setTodayHazards] = useState<HazardReport[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const canAnnounce = user.departman === "Quality" || user.departman === "Human Resources"

  const fetchAll = async () => {
    const res = await fetch("/api/dashboard/summary", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    setAnnouncements(data.announcements ?? [])
    setTodayMeetings(data.todayMeetings ?? [])
    setTodayHazards(data.todayHazards ?? [])
    setBirthdays(data.birthdays ?? [])
  }

  useEffect(() => { fetchAll() }, [])

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
    fetchAll()
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
      await fetchAll()
    } finally {
      setDeletingId(null)
    }
  }

  const canOpenMeetingsPage = user.departman === "Quality"

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-6 p-4 md:p-6">
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
                <Bell size={18} className="text-blue-600" />
                <h2 className="text-lg font-bold">Announcements</h2>
              </div>
              {canAnnounce && (
                <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
                  <Plus size={14} /> New announcement
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
              {announcements.length === 0 ? (
                <div className="border rounded-lg p-6 text-center text-gray-400 bg-white">
                  No announcements yet.
                </div>
              ) : announcements.map(a => (
                <div key={a.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDateOnlyIstanbul(a.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                  {a.creator && (
                    <p className="text-xs text-gray-400 mt-2">
                      — {a.creator.isim} {a.creator.soyisim} ({a.creator.departman})
                    </p>
                  )}
                  {canAnnounce && (
                    <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
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
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    No meetings scheduled for today.
                  </div>
                ) : todayMeetings.map(m => (
                  <div key={m.id} className="border rounded-lg p-3 bg-white flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.meetingType?.name ?? "—"} · {m.meetingNo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDateOnlyIstanbul(m.plannedDate)} (İstanbul)
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${m.status === "Completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
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
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    No hazard reports for today.
                  </div>
                ) : todayHazards.map(h => (
                  <div key={h.id} className="border rounded-lg p-3 bg-white">
                    <p className="font-medium text-sm">{h.title ?? "Untitled"}</p>
                    <p className="text-xs text-gray-500">{h.reportNo} · {h.sourceType}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
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
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    No birthdays today.
                  </div>
                ) : birthdays.map(b => (
                  <div key={b.id} className="border rounded-lg p-3 bg-pink-50 flex items-center gap-3">
                    <span className="text-2xl">🎂</span>
                    <div>
                      <p className="font-medium text-sm">{b.isim} {b.soyisim}</p>
                      <p className="text-xs text-gray-500">{b.departman}</p>
                    </div>
                  </div>
                ))}
              </div>
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Sending..." : "Publish and email staff"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
