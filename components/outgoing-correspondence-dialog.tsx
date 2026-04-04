"use client"

import * as React from "react"
import { IconFileTypePdf, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { dbDateToDdMmYyyy } from "@/lib/correspondence-date"
import {
  getOutgoingAttachmentsFromRow,
  OUTGOING_PDF_MAX_TOTAL_BYTES,
  outgoingAttachmentProxyUrl,
} from "@/lib/outgoing-correspondence-attachments"

export type OutgoingCorrespondenceRow = {
  id: number
  paperNo: string | null
  to: string | null
  subject: string | null
  date: string
  content: string | null
  pdfPath: string | null
  pdfFileName: string | null
  pdfAttachments?: unknown
}

type Mode = "create" | "edit"

type Props = {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  record: OutgoingCorrespondenceRow | null
  onSaved: () => void
}

function validatePdfFiles(files: File[]): string | null {
  const total = files.reduce((s, f) => s + f.size, 0)
  if (total > OUTGOING_PDF_MAX_TOTAL_BYTES) {
    return "Total attachment size must not exceed 50MB"
  }
  for (const f of files) {
    if (f.type !== "application/pdf") {
      return "Only PDF files are allowed"
    }
  }
  return null
}

export function OutgoingCorrespondenceDialog({
  userId,
  open,
  onOpenChange,
  mode,
  record,
  onSaved,
}: Props) {
  const uid = React.useId()
  const fileInputId = `outgoing-pdf-${uid}`

  const [paperNo, setPaperNo] = React.useState("")
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [date, setDate] = React.useState("")
  const [content, setContent] = React.useState("")
  const [pdfFiles, setPdfFiles] = React.useState<File[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setPdfFiles([])
    if (mode === "edit" && record) {
      setPaperNo(record.paperNo ?? "")
      setTo(record.to ?? "")
      setSubject(record.subject ?? "")
      setDate(dbDateToDdMmYyyy(record.date))
      setContent(record.content ?? "")
    } else {
      setPaperNo("")
      setTo("")
      setSubject("")
      setDate("")
      setContent("")
    }
    const el = document.getElementById(fileInputId) as HTMLInputElement | null
    if (el) el.value = ""
  }, [open, mode, record, fileInputId])

  const existingAttachments = React.useMemo(() => {
    if (!record) return []
    return getOutgoingAttachmentsFromRow(record)
  }, [record])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (incoming.length === 0) return

    const combined = [...pdfFiles, ...incoming]
    const err = validatePdfFiles(combined)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setPdfFiles(combined)
  }

  const removePdfAt = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const dateParts = date.split(".")
      if (dateParts.length !== 3) {
        setError("Invalid date format")
        setSubmitting(false)
        return
      }
      const [day, month, year] = dateParts
      const isoDate = `${year}-${month}-${day}`

      const formData = new FormData()
      formData.append("to", to)
      formData.append("subject", subject)
      formData.append("date", isoDate)
      formData.append("content", content)
      formData.append("createdBy", userId)
      if (mode === "create" && paperNo.trim()) {
        formData.append("paperNo", paperNo.trim())
      }
      for (const f of pdfFiles) {
        formData.append("pdf", f)
      }

      const url =
        mode === "create"
          ? "/api/outgoing-correspondences"
          : `/api/outgoing-correspondences/${record!.id}`
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || "Request failed")
        return
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError("An error occurred while saving")
    } finally {
      setSubmitting(false)
    }
  }

  const pendingBytes = pdfFiles.reduce((s, f) => s + f.size, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-6 sm:max-w-3xl">
        <DialogHeader className="shrink-0 space-y-2 pr-10 text-left">
          <DialogTitle>
            {mode === "create" ? "New outgoing correspondence" : "Edit outgoing correspondence"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add correspondence number (optional), recipient, subject, date, and optional PDFs (total max 50MB)."
              : "Update fields. Choosing new PDFs replaces all current attachments (total max 50MB)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden py-2 pr-1">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm break-words text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`paperNo-${uid}`}>Correspondence no</Label>
            {mode === "create" ? (
              <>
                <Input
                  id={`paperNo-${uid}`}
                  value={paperNo}
                  onChange={(e) => setPaperNo(e.target.value)}
                  placeholder="e.g. BON-CMM-2026-001 (optional — auto if empty)"
                  autoComplete="off"
                />
                <p className="text-muted-foreground text-xs">
                  Leave blank to assign the next automatic number (BON-OC-001, …).
                </p>
              </>
            ) : (
              <Input
                id={`paperNo-${uid}`}
                value={paperNo}
                readOnly
                disabled
                className="bg-muted"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`to-${uid}`}>To</Label>
            <Input
              id={`to-${uid}`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Enter recipient name..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`subject-${uid}`}>Subject</Label>
            <Input
              id={`subject-${uid}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="dd.mm.yyyy"
            />
            <p className="text-muted-foreground text-xs">
              Type the date or use the calendar button (day.month.year).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`content-${uid}`}>Content</Label>
            <Textarea
              id={`content-${uid}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter content details..."
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fileInputId}>PDF attachments (total max 50MB)</Label>
            {mode === "edit" && existingAttachments.length > 0 && pdfFiles.length === 0 && (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {existingAttachments.map((a) => {
                  const href = outgoingAttachmentProxyUrl(a.path)
                  return (
                    <li key={a.path} className="flex items-center gap-1">
                      <IconFileTypePdf className="size-3.5 shrink-0" />
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {a.fileName}
                        </a>
                      ) : (
                        <span>{a.fileName}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={fileInputId}
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
              >
                Choose files
              </label>
              <Input
                id={fileInputId}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {pdfFiles.length > 0 && (
              <ul className="space-y-2">
                {pdfFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${i}`}
                    className="bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => removePdfAt(i)}
                      aria-label={`Remove ${f.name}`}
                    >
                      <IconX className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-xs">
              {pdfFiles.length === 0
                ? "You can select multiple PDFs; combined size must not exceed 50MB."
                : `Selected: ${(pendingBytes / (1024 * 1024)).toFixed(2)} MB / 50 MB`}
            </p>
          </div>
          </div>

          <DialogFooter className="bg-background mt-2 shrink-0 gap-2 border-t pt-4 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !to || !subject || !date}>
              {submitting ? "Saving…" : mode === "create" ? "Submit" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
