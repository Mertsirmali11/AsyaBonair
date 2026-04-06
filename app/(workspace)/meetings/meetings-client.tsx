"use client"

import { formatDateOnlyIstanbul } from "@/lib/date-format"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react"

interface Calisan { id: number; isim: string | null; soyisim: string | null; departman: string | null }
interface MeetingType { id: number; name: string; code: string }
interface Meeting {
  id: number
  meetingNo: string
  title: string
  plannedDate: string
  initializedDate: string | null
  isOnline: boolean
  status: string
  externalParticipants: string | null  // bunu ekle
  meetingType: MeetingType | null
  participants: { calisan: { isim: string | null; soyisim: string | null } }[]
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const YEARS = ["All", "2026", "2025", "2024", "2023"]

type ExternalParticipantRow = {
  firstName: string
  lastName: string
  email: string
}

function parseExternalParticipantsJson(json: string | null): unknown[] {
  if (!json) return []
  try {
    const data = JSON.parse(json) as unknown
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function formatExternalParticipantLabel(item: unknown): string {
  if (typeof item === "string") return item.trim()
  if (item && typeof item === "object" && "email" in item) {
    const o = item as { firstName?: string; lastName?: string; email?: string }
    const n = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim()
    const e = String(o.email ?? "").trim()
    if (n && e) return `${n} (${e})`
    return e || n
  }
  return ""
}

const statusColor = (status: string) => {
  if (status === "Completed") return "bg-green-100 text-green-700"
  if (status === "Cancelled") return "bg-red-100 text-red-700"
  return "bg-blue-100 text-blue-700"
}

export function MeetingsClient({
  calisanlar,
  meetingTypes,
}: {
  calisanlar: Calisan[]
  meetingTypes: MeetingType[]
}) {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [year, setYear] = useState("All")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [open, setOpen] = useState(false)

  const [title, setTitle] = useState("")
  const [plannedDate, setPlannedDate] = useState("")
  const [meetingTypeId, setMeetingTypeId] = useState("")
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([])
  const [externalFirstName, setExternalFirstName] = useState("")
  const [externalLastName, setExternalLastName] = useState("")
  const [externalEmail, setExternalEmail] = useState("")
  const [externalParticipants, setExternalParticipants] = useState<ExternalParticipantRow[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [agenda, setAgenda] = useState("")
  const [participantSearch, setParticipantSearch] = useState("")
  const [participantDropdownOpen, setParticipantDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchMeetings = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/meetings?year=${year}`, { signal })
        const text = await res.text()
        if (signal?.aborted) return
        if (!text) {
          setMeetings([])
          setPage(1)
          return
        }
        const data = JSON.parse(text) as unknown
        if (!res.ok || !Array.isArray(data)) {
          setMeetings([])
          setPage(1)
          return
        }
        setMeetings(data as Meeting[])
        setPage(1)
      } catch {
        if (!signal?.aborted) {
          setMeetings([])
          setPage(1)
        }
      }
    },
    [year]
  )

  useEffect(() => {
    const ac = new AbortController()
    void fetch(`/api/meetings?year=${year}`, { signal: ac.signal })
      .then(async (res) => {
        const text = await res.text()
        if (ac.signal.aborted) return
        if (!text) {
          setMeetings([])
          setPage(1)
          return
        }
        try {
          const data = JSON.parse(text) as unknown
          if (!res.ok || !Array.isArray(data)) {
            setMeetings([])
            setPage(1)
            return
          }
          setMeetings(data as Meeting[])
          setPage(1)
        } catch {
          setMeetings([])
          setPage(1)
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setMeetings([])
          setPage(1)
        }
      })
    return () => ac.abort()
  }, [year])

  const paginated = meetings.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(meetings.length / pageSize) || 1

  const filteredCalisanlar = calisanlar.filter(c =>
    `${c.isim} ${c.soyisim}`.toLowerCase().includes(participantSearch.toLowerCase())
  )

  const toggleParticipant = (id: number) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const addExternalParticipant = () => {
    const email = externalEmail.trim()
    const firstName = externalFirstName.trim()
    const lastName = externalLastName.trim()
    if (!email.includes("@")) return
    const lower = email.toLowerCase()
    if (externalParticipants.some(p => p.email.toLowerCase() === lower)) return
    setExternalParticipants(prev => [...prev, { firstName, lastName, email }])
    setExternalFirstName("")
    setExternalLastName("")
    setExternalEmail("")
  }

  const resetForm = () => {
    setTitle(""); setPlannedDate(""); setMeetingTypeId("")
    setSelectedParticipants([]); setIsOnline(false); setAgenda("")
    setParticipantSearch("")
    setExternalFirstName(""); setExternalLastName(""); setExternalEmail(""); setExternalParticipants([])
  }

  const handleCreate = async () => {
    if (!title || !plannedDate || !meetingTypeId) return
    if (selectedParticipants.length === 0 && externalParticipants.length === 0) return
    setSaving(true)
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, plannedDate, meetingTypeId,
        participantIds: selectedParticipants,
        externalEmails: externalParticipants,
        isOnline, agenda
      }),
    })
    setSaving(false)
    setOpen(false)
    resetForm()
    fetchMeetings()
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-2xl font-bold">Meeting Plans</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <CalendarCheck2 size={16} />
          Plan a Meeting
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filter by Year:</span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10" />
              <TableHead>Meeting No</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Planned Date</TableHead>
              <TableHead>Type Name</TableHead>
              <TableHead>Initialized Date</TableHead>
              <TableHead>Participators</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-10">No meetings found.</TableCell>
              </TableRow>
            ) : paginated.map(m => (
              <TableRow key={m.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/meetings/${m.id}`)}>
                <TableCell><button className="p-1 rounded hover:bg-gray-200">⋮</button></TableCell>
                <TableCell className="font-mono text-sm">{m.meetingNo}</TableCell>
                <TableCell className="max-w-xs truncate">{m.title}</TableCell>
                <TableCell>{formatDateOnlyIstanbul(m.plannedDate)}</TableCell>
                <TableCell>{m.meetingType?.name ?? "—"}</TableCell>
                <TableCell>{m.initializedDate ? formatDateOnlyIstanbul(m.initializedDate) : "—"}</TableCell>
                <TableCell className="max-w-xs truncate">
  {[
    ...m.participants.map(p => `${p.calisan.isim} ${p.calisan.soyisim}`),
    ...parseExternalParticipantsJson(m.externalParticipants).map(formatExternalParticipantLabel),
  ].filter(Boolean).join(", ")}
</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor(m.status)}`}>{m.status}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-sm">
            <span>Page Size:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="w-16 h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>{meetings.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, meetings.length)} of {meetings.length}</span>
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 disabled:opacity-40">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 disabled:opacity-40"><ChevronRight size={16} /></button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1 disabled:opacity-40">»</button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a New Meeting</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Meeting Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Meeting Type <span className="text-red-500">*</span></Label>
              <Select value={meetingTypeId} onValueChange={setMeetingTypeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {meetingTypes.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sistemdeki Katılımcılar */}
            <div>
              <Label>Participators</Label>
              <div className="relative mt-1">
                <div
                  className="min-h-10 border rounded-md px-2 py-1 flex flex-wrap gap-1 items-center cursor-text bg-white focus-within:ring-2 focus-within:ring-ring"
                  onClick={() => setParticipantDropdownOpen(true)}
                >
                  {selectedParticipants.map(id => {
                    const c = calisanlar.find(x => x.id === id)
                    if (!c) return null
                    return (
                      <span key={id} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                        {c.isim} {c.soyisim}
                        <button type="button" className="hover:text-red-500 font-bold"
                          onClick={e => { e.stopPropagation(); toggleParticipant(id) }}>×</button>
                      </span>
                    )
                  })}
                  <input
                    className="flex-1 min-w-24 outline-none text-sm py-0.5 bg-transparent"
                    placeholder={selectedParticipants.length === 0 ? "Select or type participants..." : ""}
                    value={participantSearch}
                    onChange={e => { setParticipantSearch(e.target.value); setParticipantDropdownOpen(true) }}
                    onFocus={() => setParticipantDropdownOpen(true)}
                  />
                </div>
                {participantDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setParticipantDropdownOpen(false)} />
                    <div className="absolute z-20 w-full mt-1 border rounded-md bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredCalisanlar.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">No results found</div>
                      ) : filteredCalisanlar.map(c => (
                        <div key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${selectedParticipants.includes(c.id) ? "bg-blue-50 font-medium" : ""}`}
                          onClick={() => { toggleParticipant(c.id); setParticipantSearch("") }}
                        >
                          {selectedParticipants.includes(c.id) && <span className="text-blue-600">✓</span>}
                          <span className={selectedParticipants.includes(c.id) ? "text-blue-700" : ""}>{c.isim} {c.soyisim}</span>
                          {c.departman && <span className="text-gray-400 text-xs ml-auto">{c.departman}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {selectedParticipants.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{selectedParticipants.length} selected</p>
              )}
            </div>

            {/* External participants */}
            <div>
              <Label>External Participators</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Enter first name, last name, and email, then click + to add. Invitation emails are sent to the email address only.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">First name</Label>
                  <Input
                    placeholder="First name"
                    value={externalFirstName}
                    onChange={e => setExternalFirstName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Last name</Label>
                  <Input
                    placeholder="Last name"
                    value={externalLastName}
                    onChange={e => setExternalLastName(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-muted-foreground">Email <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="name@example.com"
                    value={externalEmail}
                    onChange={e => setExternalEmail(e.target.value)}
                    className="mt-1"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addExternalParticipant()
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="h-9 min-w-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={addExternalParticipant}
                    title="Add external participant"
                  >
                    +
                  </button>
                </div>
              </div>
              {externalParticipants.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {externalParticipants.map(p => (
                    <span
                      key={p.email}
                      className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-900"
                    >
                      <span className="min-w-0 truncate">
                        {[p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "—"}
                        <span className="text-muted-foreground"> · </span>
                        {p.email}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 font-bold text-green-700 hover:text-red-600"
                        onClick={() =>
                          setExternalParticipants(prev => prev.filter(x => x.email !== p.email))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-yellow-50 px-3 py-2">
              <Label className="flex-1">Online Meeting</Label>
              <Switch checked={isOnline} onCheckedChange={setIsOnline} />
            </div>
            <div>
              <Label>Agenda</Label>
              <Textarea placeholder="Meeting Agenda" value={agenda} onChange={e => setAgenda(e.target.value)} className="mt-1" />
            </div>
            <Button
              onClick={handleCreate}
              disabled={saving || !title || !plannedDate || !meetingTypeId || (selectedParticipants.length === 0 && externalParticipants.length === 0)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
