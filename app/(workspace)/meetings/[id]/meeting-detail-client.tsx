"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MeetingTasks } from "@/components/meeting-tasks"
import {
  Upload, History, Paperclip, Users, ClipboardList, ListChecks,
  Download, FileText, FileSpreadsheet, ChevronDown, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  meetingTime: string | null
  location: string | null
  compiledBy: string | null
  meetingType: { name: string } | null
  participants: {
    calisan: {
      isim: string | null
      soyisim: string | null
      departman: string | null
    }
  }[]
  filePath: string | null
  fileName: string | null
  externalParticipants: string | null
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-2 border-b last:border-b-0 py-2.5 px-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div>{children}</div>
    </div>
  )
}

export function MeetingDetailClient({
  meeting,
  calisanlar,
  hazardReports,
  currentUserName,
  highlightTaskId = null,
  canEdit = false,
}: {
  meeting: Meeting
  calisanlar: Calisan[]
  hazardReports: HazardReport[]
  currentUserName: string
  highlightTaskId?: number | null
  canEdit?: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(meeting.title)
  const [actualDate, setActualDate] = useState(
    meeting.actualDate ? new Date(meeting.actualDate).toISOString().split("T")[0] : ""
  )
  const [meetingTime, setMeetingTime] = useState(meeting.meetingTime ?? "")
  const [location, setLocation] = useState(meeting.location ?? "")
  const [agenda, setAgenda] = useState(meeting.agenda ?? "")
  const [minutes, setMinutes] = useState(meeting.meetingMinutes ?? "")
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ path: string; name: string } | null>(
    meeting.filePath ? { path: meeting.filePath, name: meeting.fileName ?? "file" } : null
  )
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)

  // Auto-save tracking
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const markDirty = useCallback(() => { dirtyRef.current = true }, [])

  const compiledBy = meeting.compiledBy ?? currentUserName

  // Keep save in a ref so the interval always calls the latest closure
  const saveRef = useRef<((extra?: Record<string, unknown>) => Promise<void>) | null>(null)

  const save = async (extraData?: Record<string, unknown>) => {
    savingRef.current = true
    setSaving(true)
    try {
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          actualDate: actualDate ? new Date(actualDate) : null,
          meetingTime: meetingTime || null,
          location: location || null,
          compiledBy,
          agenda: agenda || null,
          meetingMinutes: minutes || null,
          ...extraData,
        }),
      })
      setLastSaved(new Date())
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // Keep ref fresh every render
  saveRef.current = save

  // Auto-save every 10 seconds if there are unsaved changes
  useEffect(() => {
    if (!canEdit) return
    const timer = setInterval(() => {
      if (dirtyRef.current && !savingRef.current) {
        dirtyRef.current = false
        void saveRef.current?.()
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [canEdit])

  const handleSave = () => {
    dirtyRef.current = false
    void save()
  }

  const handleSubmit = async () => {
    await save({ status: "Completed" })
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
    const data = await res.json() as { filePath: string; fileName: string }
    setAttachedFile({ path: data.filePath, name: data.fileName })
    setUploadingFile(false)
  }

  const history = [
    {
      date: meeting.initializedDate
        ? new Date(meeting.initializedDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      text: `Meeting planned by ${currentUserName} (Date: ${new Date(meeting.plannedDate).toISOString().split("T")[0]})`,
    },
  ]

  const plannedDateStr = new Date(meeting.plannedDate).toISOString().split("T")[0]
  const dateStr = actualDate || plannedDateStr

  // ── helpers ──────────────────────────────────────────────────────────────
  interface TaskRow { id: number; title: string; status: string; dueDate: string | null; assignee: { isim: string | null; soyisim: string | null } | null }

  const fetchTasks = async (): Promise<TaskRow[]> => {
    try {
      const res = await fetch(`/api/tasks?meetingId=${meeting.id}`)
      return res.ok ? (await res.json() as TaskRow[]) : []
    } catch { return [] }
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const tasks = await fetchTasks()
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W = doc.internal.pageSize.getWidth()
      let y = 14

      // Header
      doc.setFontSize(13).setFont("helvetica", "bold")
      doc.text("BON AIR HAVACILIK", W / 2, y, { align: "center" })
      y += 6
      doc.setFontSize(10).setFont("helvetica", "normal")
      doc.text("MEETING FORM  –  BON-CMM-FR-010 Rev.02", W / 2, y, { align: "center" })
      y += 8

      // ── Meeting Information ──
      doc.setFontSize(8).setFont("helvetica", "bold")
      doc.setFillColor(5, 150, 105)
      doc.rect(14, y, W - 28, 6, "F")
      doc.setTextColor(255, 255, 255)
      doc.text("MEETING INFORMATION", 17, y + 4)
      doc.setTextColor(0, 0, 0)
      y += 8

      const infoRows: [string, string][] = [
        ["Meeting No",   meeting.meetingNo],
        ["Title",        title],
        ["Meeting Date", dateStr],
        ["Meeting Time", meetingTime || "—"],
        ["Location",     location || "—"],
        ["Compiled by",  compiledBy],
        ["Meeting Type", meeting.meetingType?.name ?? "—"],
        ["Status",       meeting.status],
      ]
      autoTable(doc, {
        startY: y,
        head: [],
        body: infoRows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, fillColor: [245, 247, 250] } },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 6

      // ── Participants ──
      doc.setFontSize(8).setFont("helvetica", "bold")
      doc.setFillColor(5, 150, 105)
      doc.rect(14, y, W - 28, 6, "F")
      doc.setTextColor(255, 255, 255)
      doc.text("PARTICIPANTS", 17, y + 4)
      doc.setTextColor(0, 0, 0)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [["#", "Name & Surname", "Title / Department", "Signature"]],
        body: meeting.participants.map((p, i) => [
          String(i + 1),
          [p.calisan.isim, p.calisan.soyisim].filter(Boolean).join(" ") || "—",
          p.calisan.departman ?? "—",
          "",
        ]),
        theme: "grid",
        headStyles: { fillColor: [5, 150, 105], fontSize: 8 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 12 }, 3: { cellWidth: 40 } },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 6

      // ── Agenda ──
      doc.setFontSize(8).setFont("helvetica", "bold")
      doc.setFillColor(5, 150, 105)
      doc.rect(14, y, W - 28, 6, "F")
      doc.setTextColor(255, 255, 255)
      doc.text("TODAY'S AGENDA", 17, y + 4)
      doc.setTextColor(0, 0, 0)
      y += 8
      doc.setFontSize(9).setFont("helvetica", "normal")
      const agendaLines = doc.splitTextToSize(agenda || "—", W - 32)
      doc.text(agendaLines, 14, y)
      y += agendaLines.length * 5 + 6

      // ── Tasks ──
      if (tasks.length > 0) {
        doc.setFontSize(8).setFont("helvetica", "bold")
        doc.setFillColor(5, 150, 105)
        doc.rect(14, y, W - 28, 6, "F")
        doc.setTextColor(255, 255, 255)
        doc.text("MEETING OUTPUTS / ACTIONS", 17, y + 4)
        doc.setTextColor(0, 0, 0)
        y += 8

        autoTable(doc, {
          startY: y,
          head: [["#", "Action Item", "Responsible", "Due Date", "Status"]],
          body: tasks.map((t, i) => [
            String(i + 1),
            t.title,
            t.assignee ? [t.assignee.isim, t.assignee.soyisim].filter(Boolean).join(" ") : "—",
            t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "—",
            t.status,
          ]),
          theme: "grid",
          headStyles: { fillColor: [5, 150, 105], fontSize: 8 },
          styles: { fontSize: 9, cellPadding: 2.5 },
          columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 26 }, 4: { cellWidth: 26 } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // ── Meeting Minutes ──
      doc.setFontSize(8).setFont("helvetica", "bold")
      doc.setFillColor(5, 150, 105)
      doc.rect(14, y, W - 28, 6, "F")
      doc.setTextColor(255, 255, 255)
      doc.text("MEETING MINUTES / NOTES", 17, y + 4)
      doc.setTextColor(0, 0, 0)
      y += 8
      doc.setFontSize(9).setFont("helvetica", "normal")
      const minuteLines = doc.splitTextToSize(minutes || "—", W - 32)
      doc.text(minuteLines, 14, y)
      y += minuteLines.length * 5 + 6

      // ── Form Filling ──
      doc.setFontSize(8).setFont("helvetica", "bold")
      doc.setFillColor(5, 150, 105)
      doc.rect(14, y, W - 28, 6, "F")
      doc.setTextColor(255, 255, 255)
      doc.text("FORM FILLING", 17, y + 4)
      doc.setTextColor(0, 0, 0)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [["Form Filling by", "Name & Surname", "Signature"]],
        body: [["Compiled by", compiledBy, ""]],
        theme: "grid",
        headStyles: { fillColor: [5, 150, 105], fontSize: 8 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 2: { cellWidth: 50 } },
        margin: { left: 14, right: 14 },
      })

      doc.save(`${meeting.meetingNo}.pdf`)
    } finally { setExporting(false) }
  }

  // ── DOCX export ───────────────────────────────────────────────────────────
  const handleExportDocx = async () => {
    setExporting(true)
    try {
      const tasks = await fetchTasks()
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign,
        HeadingLevel,
      } = await import("docx")

      const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
      const borders = { top: border, bottom: border, left: border, right: border }
      const thickBorder = { style: BorderStyle.SINGLE, size: 2, color: "059669" }
      const thickBorders = { top: thickBorder, bottom: thickBorder, left: thickBorder, right: thickBorder }
      const PAGE_W = 9360  // A4 portrait content width with 1cm margins ≈ 9360 DXA

      const sectionHeader = (text: string) =>
        new Paragraph({
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Calibri" })],
          shading: { fill: "059669", type: ShadingType.CLEAR, color: "059669" },
          spacing: { before: 200, after: 100 },
        })

      const infoTable = (rows: [string, string][]) =>
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA },
          columnWidths: [2000, PAGE_W - 2000],
          borders: {
            insideHorizontal: border,
            insideVertical: border,
            top: border,
            bottom: border,
            left: border,
            right: border,
          },
          rows: rows.map(([label, value]) => new TableRow({ children: [
            new TableCell({
              borders,
              width: { size: 2000, type: WidthType.DXA },
              shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: "Calibri" })] })],
            }),
            new TableCell({
              borders,
              width: { size: PAGE_W - 2000, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 18, font: "Calibri" })] })],
            }),
          ]})),
        })

      const participantsTable = new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        columnWidths: [600, 2800, 3200, 2760],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["#", "Name & Surname", "Title / Department", "Signature"].map((h, ci) =>
              new TableCell({
                borders: thickBorders,
                width: { size: [600, 2800, 3200, 2760][ci], type: WidthType.DXA },
                shading: { fill: "059669", type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
              })
            ),
          }),
          ...meeting.participants.map((p, i) => new TableRow({ children: [
            new TableCell({ borders, width: { size: 600, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: [p.calisan.isim, p.calisan.soyisim].filter(Boolean).join(" ") || "—", bold: true, size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 3200, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: p.calisan.departman ?? "—", size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 2760, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })] }),
          ]})),
        ],
      })

      const tasksTable = tasks.length === 0 ? null : new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        columnWidths: [500, 3860, 2200, 1400, 1400],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["#", "Action Item", "Responsible", "Due Date", "Status"].map((h, ci) =>
              new TableCell({
                borders: thickBorders,
                width: { size: [500, 3860, 2200, 1400, 1400][ci], type: WidthType.DXA },
                shading: { fill: "059669", type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
              })
            ),
          }),
          ...tasks.map((t, i) => new TableRow({ children: [
            new TableCell({ borders, width: { size: 500, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 3860, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.title, size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 2200, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.assignee ? [t.assignee.isim, t.assignee.soyisim].filter(Boolean).join(" ") : "—", size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 1400, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "—", size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 1400, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.status, size: 18, font: "Calibri" })] })] }),
          ]})),
        ],
      })

      const formFillingTable = new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        columnWidths: [2500, 3500, 3360],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Form Filling by", "Name & Surname", "Signature"].map((h, ci) =>
              new TableCell({
                borders: thickBorders,
                width: { size: [2500, 3500, 3360][ci], type: WidthType.DXA },
                shading: { fill: "059669", type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18, font: "Calibri" })] })],
              })
            ),
          }),
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, shading: { fill: "F1F5F9", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Compiled by", bold: true, size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 3500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: compiledBy, size: 18, font: "Calibri" })] })] }),
            new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 18 })] })] }),
          ]}),
        ],
      })

      const children = [
        // Title block
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "BON AIR HAVACILIK", bold: true, size: 28, font: "Calibri" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "MEETING FORM  –  BON-CMM-FR-010 Rev.02", size: 20, font: "Calibri", color: "555555" })] }),

        sectionHeader("1. MEETING INFORMATION"),
        infoTable([
          ["Meeting No",   meeting.meetingNo],
          ["Title",        title],
          ["Meeting Date", dateStr],
          ["Meeting Time", meetingTime || "—"],
          ["Location",     location || "—"],
          ["Compiled by",  compiledBy],
          ["Meeting Type", meeting.meetingType?.name ?? "—"],
          ["Status",       meeting.status],
        ]),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        sectionHeader("2. PARTICIPANTS"),
        participantsTable,
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        sectionHeader("3. TODAY'S AGENDA"),
        new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: agenda || "—", size: 18, font: "Calibri" })] }),

        ...(tasksTable ? [
          sectionHeader("4. MEETING OUTPUTS / ACTIONS"),
          tasksTable,
          new Paragraph({ spacing: { after: 100 }, children: [] }),
        ] : []),

        sectionHeader(`${tasksTable ? "5" : "4"}. MEETING MINUTES / NOTES`),
        new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: minutes || "—", size: 18, font: "Calibri" })] }),

        sectionHeader(`${tasksTable ? "6" : "5"}. FORM FILLING`),
        formFillingTable,
      ]

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children,
        }],
      })

      const buffer = await Packer.toBuffer(doc)
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${meeting.meetingNo}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 pt-0 max-w-5xl mx-auto w-full">

      {/* ── Toolbar: Upload · Export · Auto-save indicator ───────────────────── */}
      <div className="flex items-center gap-3 pt-2 flex-wrap">
        {canEdit && (
          <label className="cursor-pointer">
            <input type="file" className="hidden"
              onChange={e => e.target.files?.[0] && void handleFileUpload(e.target.files[0])} />
            <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2 rounded-md transition-colors">
              <Upload size={15} />
              {uploadingFile ? "Uploading..." : "Upload Files"}
            </div>
          </label>
        )}

        {/* Export dropdown — always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exporting} className="h-9">
              <Download className="mr-1.5 size-4" />
              {exporting ? "Exporting..." : "Export"}
              <ChevronDown className="ml-1 size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => void handleExportDocx()}>
              <FileSpreadsheet className="mr-2 size-4 text-blue-600" />
              Word (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleExportPdf()}>
              <FileText className="mr-2 size-4 text-red-500" />
              PDF (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {attachedFile && (
          <a href={attachedFile.path} target="_blank"
            className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Paperclip size={14} />
            {attachedFile.name}
          </a>
        )}

        {/* Auto-save status */}
        {canEdit && lastSaved && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 size={13} className="text-emerald-500" />
            Auto-saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* ── SECTION 1: Meeting Info ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meeting Information</h2>
        </div>

        <FieldRow label="Meeting No">
          <span className="font-mono text-sm font-semibold">{meeting.meetingNo}</span>
        </FieldRow>

        <FieldRow label="Title">
          {canEdit
            ? <Input value={title} onChange={e => { setTitle(e.target.value); markDirty() }} className="h-8 text-sm" />
            : <span className="text-sm">{title}</span>
          }
        </FieldRow>

        <FieldRow label="Meeting Date">
          {canEdit
            ? <Input type="date" value={actualDate || plannedDateStr}
                onChange={e => { setActualDate(e.target.value); markDirty() }} className="h-8 text-sm max-w-[180px]" />
            : <span className="text-sm font-mono">{actualDate || plannedDateStr}</span>
          }
        </FieldRow>

        <FieldRow label="Meeting Time">
          {canEdit
            ? <Input type="time" value={meetingTime}
                onChange={e => { setMeetingTime(e.target.value); markDirty() }} className="h-8 text-sm max-w-[140px]" />
            : <span className="text-sm font-mono">{meetingTime || "—"}</span>
          }
        </FieldRow>

        <FieldRow label="Location">
          {canEdit
            ? <Input value={location} onChange={e => { setLocation(e.target.value); markDirty() }}
                placeholder="e.g. Conference Room A / Online" className="h-8 text-sm" />
            : <span className="text-sm">{location || "—"}</span>
          }
        </FieldRow>

        <FieldRow label="Compiled by">
          <span className="text-sm">{compiledBy}</span>
        </FieldRow>

        <FieldRow label="Meeting Type">
          <span className="text-sm">{meeting.meetingType?.name ?? "—"}</span>
        </FieldRow>

        <FieldRow label="Status">
          <span className={cn(
            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
            meeting.status === "Completed" && "bg-teal-100 text-teal-700",
            meeting.status === "Planned" && "bg-blue-100 text-blue-700",
            meeting.status === "Cancelled" && "bg-red-100 text-red-700",
            !["Completed","Planned","Cancelled"].includes(meeting.status) && "bg-muted text-muted-foreground",
          )}>
            {meeting.status}
          </span>
        </FieldRow>
      </div>

      {/* ── SECTION 2: Participants ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center gap-2">
          <Users size={14} className="text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Participants</h2>
        </div>

        {meeting.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3 italic">No participants assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-semibold w-8">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Name &amp; Surname</th>
                  <th className="px-4 py-2 text-left font-semibold">Title / Department</th>
                  <th className="px-4 py-2 text-left font-semibold text-muted-foreground/60">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {meeting.participants.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {[p.calisan.isim, p.calisan.soyisim].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.calisan.departman ?? "—"}</td>
                    <td className="px-4 py-2.5 border-l border-dashed min-w-[120px]"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* External participants */}
        {meeting.externalParticipants && (
          <div className="px-4 py-2.5 border-t text-sm text-muted-foreground">
            <span className="font-medium">External: </span>{meeting.externalParticipants}
          </div>
        )}
      </div>

      {/* ── SECTION 3: Today's Agenda ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center gap-2">
          <ClipboardList size={14} className="text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Today&apos;s Agenda</h2>
        </div>

        {/* Current Meeting Inputs */}
        <div className="p-4 border-b">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
            Current Meeting Inputs
          </Label>
          {canEdit ? (
            <Textarea
              value={agenda}
              onChange={e => { setAgenda(e.target.value); markDirty() }}
              placeholder={"1.\n2.\n3.\n..."}
              className="min-h-[140px] text-sm font-mono resize-y"
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap text-foreground min-h-[40px]">
              {agenda || <span className="text-muted-foreground italic">No agenda items.</span>}
            </div>
          )}
        </div>

        {/* Meeting Outputs / Actions */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Meeting Outputs / Actions
            </span>
          </div>
          <MeetingTasks
            meetingId={meeting.id}
            calisanlar={calisanlar}
            highlightTaskId={highlightTaskId}
          />
        </div>
      </div>

      {/* ── SECTION 4: Meeting Minutes ────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meeting Minutes / Notes</h2>
        </div>
        <div className="p-4">
          {canEdit ? (
            <>
              <Textarea
                value={minutes}
                onChange={e => { setMinutes(e.target.value); markDirty() }}
                placeholder="Write meeting minutes..."
                className="min-h-[160px] text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {minutes.length} / 30000 characters
              </p>
            </>
          ) : (
            <div className="text-sm whitespace-pre-wrap min-h-[40px]">
              {minutes || <span className="text-muted-foreground italic">No minutes recorded.</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 5: Form Filling Sign-off ──────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Form Filling</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-semibold">Form Filling by</th>
                <th className="px-4 py-2 text-left font-semibold">Name &amp; Surname</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground/60">Signature</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Compiled by</td>
                <td className="px-4 py-3 font-medium">{compiledBy}</td>
                <td className="px-4 py-3 border-l border-dashed min-w-[160px]"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Access warning ────────────────────────────────────────────────────── */}
      {!canEdit && (
        <p className="text-sm text-muted-foreground text-center rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-2 px-4">
          Bu toplantıyı düzenlemek için katılımcı olmanız gerekir.
        </p>
      )}

      {/* ── Save / Submit ─────────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="flex gap-2 justify-end pb-4">
          <Button onClick={handleSave} disabled={saving} variant="outline" className="px-8">
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">
            {saving ? "Submitting..." : "Submit"}
          </Button>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <History size={15} className="text-primary" />
          <h3 className="font-semibold text-sm">History</h3>
        </div>
        <ul className="flex flex-col gap-1">
          {history.map((h, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              › {h.date} — {h.text}
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
