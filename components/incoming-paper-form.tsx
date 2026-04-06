"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ALLOWED_DOCUMENTS_ERROR_EN,
  DOCUMENT_ACCEPT_HTML,
  isAllowedCorrespondenceDocumentFile,
} from "@/lib/allowed-document-uploads"

interface IncomingPaperFormProps {
  userId: string
}

export function IncomingPaperForm({ userId }: IncomingPaperFormProps) {
  const [from, setFrom] = useState<string>("")
  const [subject, setSubject] = useState<string>("")
  const [date, setDate] = useState<string>("")
  const [content, setContent] = useState<string>("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
      if (!isAllowedCorrespondenceDocumentFile(file)) {
        setError(ALLOWED_DOCUMENTS_ERROR_EN)
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
    setSuccess(false)

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
      if (pdfFile) {
        formData.append("pdf", pdfFile)
      }

      const response = await fetch("/api/incoming-papers", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit incoming correspondence")
        return
      }

      setSuccess(true)
      setFrom("")
      setSubject("")
      setDate("")
      setContent("")
      setPdfFile(null)
      const fileInput = document.getElementById("pdf-file") as HTMLInputElement
      if (fileInput) {
        fileInput.value = ""
      }
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      console.error("Error submitting incoming correspondence:", err)
      setError("An error occurred while submitting the correspondence")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Incoming Correspondences</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            {success && (
              <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400">
                Incoming correspondence submitted successfully!
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="from" className="text-sm font-medium">
                From
              </Label>
              <Input
                id="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Enter sender name..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">
                Date
              </Label>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="Select date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium">
                Content
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter content details..."
                className="w-full min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-file" className="text-sm font-medium">
                Attachment — PDF, Word, Excel, PowerPoint (max 50MB)
              </Label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="pdf-file"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Choose File
                </label>
                <Input
                  id="pdf-file"
                  type="file"
                  accept={DOCUMENT_ACCEPT_HTML}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-sm text-muted-foreground">
                  {pdfFile ? pdfFile.name : "No file chosen"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="submit"
                disabled={submitting || !from || !subject || !date}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

