"use client"
import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Bell, Plus, Calendar, AlertTriangle, Cake } from "lucide-react"
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

  const canAnnounce = user.departman === "Quality" || user.departman === "Human Resources"

  const fetchAll = async () => {
    const [annRes, meetRes, hazRes, birthRes] = await Promise.all([
      fetch("/api/announcements"),
      fetch("/api/dashboard/today-meetings"),
      fetch("/api/dashboard/today-hazards"),
      fetch("/api/dashboard/birthdays"),
    ])
    if (annRes.ok) setAnnouncements(await annRes.json())
    if (meetRes.ok) setTodayMeetings(await meetRes.json())
    if (hazRes.ok) setTodayHazards(await hazRes.json())
    if (birthRes.ok) setBirthdays(await birthRes.json())
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

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SOL — Duyurular */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-blue-600" />
                <h2 className="text-lg font-bold">Duyurular</h2>
              </div>
              {canAnnounce && (
                <Button size="sm" onClick={() => setOpen(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus size={14} /> Duyuru Ekle
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
              {announcements.length === 0 ? (
                <div className="border rounded-lg p-6 text-center text-gray-400 bg-white">
                  Henüz duyuru yok.
                </div>
              ) : announcements.map(a => (
                <div key={a.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                  {a.creator && (
                    <p className="text-xs text-gray-400 mt-2">
                      — {a.creator.isim} {a.creator.soyisim} ({a.creator.departman})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ — Bugün */}
          <div className="flex flex-col gap-4">

            {/* Bugünkü Meetingler */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-green-600" />
                <h2 className="text-lg font-bold">Bugünkü Toplantılar</h2>
              </div>
              <div className="flex flex-col gap-2">
                {todayMeetings.length === 0 ? (
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    Bugün için planlanmış toplantı yok.
                  </div>
                ) : todayMeetings.map(m => (
                  <div key={m.id} className="border rounded-lg p-3 bg-white flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.meetingType?.name ?? "—"} · {m.meetingNo}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${m.status === "Completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bugünkü Hazardlar */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-lg font-bold">Bugünkü Hazard Raporları</h2>
              </div>
              <div className="flex flex-col gap-2">
                {todayHazards.length === 0 ? (
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    Bugün için hazard raporu yok.
                  </div>
                ) : todayHazards.map(h => (
                  <div key={h.id} className="border rounded-lg p-3 bg-white">
                    <p className="font-medium text-sm">{h.title ?? "Başlıksız"}</p>
                    <p className="text-xs text-gray-500">{h.reportNo} · {h.sourceType}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bugün Doğanlar */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cake size={18} className="text-pink-500" />
                <h2 className="text-lg font-bold">Bugün Doğanlar 🎂</h2>
              </div>
              <div className="flex flex-col gap-2">
                {birthdays.length === 0 ? (
                  <div className="border rounded-lg p-4 text-center text-gray-400 bg-white text-sm">
                    Bugün doğan çalışan yok.
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

      {/* Duyuru Ekleme Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Duyuru</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>Başlık <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı" className="mt-1" />
            </div>
            <div>
              <Label>İçerik <span className="text-red-500">*</span></Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Duyuru içeriği..." className="mt-1 min-h-32" />
            </div>
            <Button
              onClick={handleAnnounce}
              disabled={saving || !title || !content}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Gönderiliyor..." : "Yayınla ve Mail Gönder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
