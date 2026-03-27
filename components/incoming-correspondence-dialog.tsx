"use client"

import * as React from "react"
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

export type IncomingCorrespondenceRow = {
  id: number
  from: string | null
  subject: string | null
  date: string
  content: string | null
  pdfPath: string | null
  pdfFileName: string | null
}

type Mode = "create" | "edit"

type Props = {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  record: IncomingCorrespondenceRow | null
  onSaved: () => void
}

export function IncomingCorrespondenceDialog({
  userId,
  open,
  onOpenChange,
  mode,
  record,
  onSaved,
}: Props) {
  const uid = React.useId()
  const fileInputId = `incoming-pdf-${uid}`

  const [from, setFrom] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [date, setDate] = React.useState("")
  const [content, setContent] = React.useState("")
  const [pdfFile, setPdfFile] = React.useState<File | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setPdfFile(null)
    if (mode === "edit" && record) {
      setFrom(record.from ?? "")
      setSubject(record.subject ?? "")
      setDate(dbDateToDdMmYyyy(record.date))
      setContent(record.content ?? "")
    } else {
      setFrom("")
      setSubject("")
      setDate("")
      setContent("")
    }
    const el = document.getElementById(fileInputId) as HTMLInputElement | null
    if (el) el.value = ""
  }, [open, mode, record, fileInputId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        setError("File size exceeds 50MB limit")
        setPdfFile(null)
        e.target.value = ""
        return
      }
      if (file.type !== "application/pdf") {
        setError("Only PDF files are allowed")
        setPdfFile(null)
        e.target.value = ""
        return
      }
      setError(null)
      setPdfFile(file)
    }
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
      formData.append("from", from)
      formData.append("subject", subject)
      formData.append("date", isoDate)
      formData.append("content", content)
      formData.append("createdBy", userId)
      if (pdfFile) formData.append("pdf", pdfFile)

      const url =
        mode === "create"
          ? "/api/incoming-papers"
          : `/api/incoming-papers/${record!.id}`
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New incoming correspondence" : "Edit incoming correspondence"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add sender, subject, date, and optional PDF (max 50MB)."
              : "Update fields. Upload a new PDF to replace the existing attachment."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`from-${uid}`}>From</Label>
            <Input
              id={`from-${uid}`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Enter sender name..."
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
            <DatePicker value={date} onChange={setDate} placeholder="Select date" />
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
            <Label htmlFor={fileInputId}>PDF attachment (max 50MB)</Label>
            {mode === "edit" && record?.pdfFileName && !pdfFile && (
              <p className="text-muted-foreground text-xs">
                Current file: {record.pdfFileName}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={fileInputId}
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
              >
                Choose file
              </label>
              <Input
                id={fileInputId}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="text-muted-foreground text-sm">
                {pdfFile ? pdfFile.name : "No file chosen"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !from || !subject || !date}>
              {submitting ? "Saving…" : mode === "create" ? "Submit" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
