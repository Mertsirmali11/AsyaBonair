"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MeetingTasks } from "@/components/meeting-tasks"
import { Upload, History, FileText, ClipboardList, BarChart2, Paperclip } from "lucide-react"

interface Calisan { id: number; isim: string | null; soyisim: string | null }
interface HazardReport {
  id: number
  reportNo: string | null
  title: string | null
  eventDate: string
  sourceType: string | null
  reporter: { isim: string | null; soyisim: string | null } | null
}
interface Meeting {
  id: number
  meetingNo: string
  title: string
  plannedDate: string
  initializedDate: string | null
  isOnline: boolean
  agenda: string | null
  status: string
  meetingMinutes: string | null
  actualDate: string | null
  meetingType: { name: string } | null
  participants: { calisan: { isim: string | null; soyisim: string | null; departman: string | null } }[]
  filePath: string | null
  fileName: string | null
}

export function MeetingDetailClient({
  meeting,
  calisanlar,
  hazardReports,
  currentUserName,
}: {
  meeting: Meeting
  calisanlar: Calisan[]
  hazardReports: HazardReport[]
  currentUserName: string
}) {
  const router = useRouter()
  const [title, setTitle] = useState(meeting.title)
  const [actualDate, setActualDate] = useState(
    meeting.actualDate ? new Date(meeting.actualDate).toISOString().split("T")[0] : ""
  )
  const [minutes, setMinutes] = useState(meeting.meetingMinutes ?? "")
  const [selectedReports, setSelectedReports] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ path: string; name: string } | null>(
    meeting.filePath ? { path: meeting.filePath, name: meeting.fileName ?? "file" } : null
  )

  const toggleReport = (id: number) => {
    setSelectedReports(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    setSaving(true)
    await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        actualDate: actualDate ? new Date(actualDate) : null,
        meetingMinutes: minutes,
        status: "Completed",
      }),
    })
    setSaving(false)
    router.push("/meetings")
  }

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`/api/meetings/${meeting.id}/upload`, {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    setAttachedFile({ path: data.filePath, name: data.fileName })
    setUploadingFile(false)
  }

  const history = [
    {
      date: meeting.initializedDate
        ? new Date(meeting.initializedDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      text: `Meeting Planned by ${currentUserName} (Date : ${new Date(meeting.plannedDate).toISOString().split("T")[0]})`,
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">

        {/* SOL PANEL */}
        <div className="flex flex-col gap-4">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <Upload size={15} />
              {uploadingFile ? "Uploading..." : "Upload Files"}
            </div>
          </label>

          {attachedFile && (
            <a href={attachedFile.path} target="_blank"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Paperclip size={14} />
              {attachedFile.name}
            </a>
          )}

          <div className="border rounded-lg p-4 bg-white">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <Label>Actual Meeting Date</Label>
            <Input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="mt-1" />
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <Label>Meeting Minutes</Label>
            <Textarea
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              placeholder="Write meeting minutes..."
              className="mt-2 min-h-48"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {minutes.length} / 30000 characters | {minutes.trim() === "" ? 0 : minutes.trim().split(/\s+/).length} words
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white self-end px-8"
          >
            {saving ? "Submitting..." : "Submit"}
          </Button>
        </div>

        {/* SAĞ PANEL */}
        <div className="flex flex-col gap-4">

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={15} className="text-gray-500" />
              <h3 className="font-semibold text-sm">Meeting Agenda</h3>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {meeting.agenda ?? <span className="text-gray-400 italic">No agenda set.</span>}
            </p>
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <MeetingTasks meetingId={meeting.id} calisanlar={calisanlar} />
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 size={15} className="text-gray-500" />
              <h3 className="font-semibold text-sm">Risk Analysis Initialized</h3>
            </div>
            <p className="text-sm text-gray-400 italic">— No risk analysis initialized.</p>
          </div>

          {!attachedFile && (
            <div className="border rounded-lg p-4 bg-white flex items-center justify-center text-sm text-gray-400">
              No attachment
            </div>
          )}

          <div className="border rounded-lg p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <History size={15} className="text-blue-600" />
              <h3 className="font-semibold text-sm text-blue-700">History</h3>
            </div>
            <ul className="flex flex-col gap-1">
              {history.map((h, i) => (
                <li key={i} className="text-xs text-gray-600">
                  › {h.date} — {h.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-gray-500" />
              <h3 className="font-semibold text-sm">Evaluated & Analyzed Reports</h3>
            </div>
            <div className="max-h-52 overflow-y-auto flex flex-col gap-1">
              {hazardReports.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No reports available.</p>
              ) : hazardReports.map(r => (
                <label key={r.id} className="flex items-start gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedReports.includes(r.id)}
                    onChange={() => toggleReport(r.id)}
                    className="mt-0.5"
                  />
                  <span>
                    {r.title ?? "Untitled"} by {r.reporter ? `${r.reporter.isim} ${r.reporter.soyisim}` : "Unknown"}
                    {" "}— ({r.sourceType ?? "Hazard"}, {new Date(r.eventDate).toISOString().split("T")[0]})
                  </span>
                </label>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
