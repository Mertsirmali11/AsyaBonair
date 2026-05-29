"use client"

import { useState, useRef, useCallback } from "react"
import { IconUpload, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePickerLimited } from "@/components/ui/date-picker-limited"
import { DOCUMENT_ACCEPT_HTML } from "@/lib/allowed-document-uploads"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ReportHazardFormProps {
  userId: string
}

const SOURCE_TYPES = [
  "Safety Observation",
  "Incident Report",
  "Near Miss",
  "Hazard Identification",
  "Other",
]

const MAX_FILE_BYTES = 50 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ReportHazardForm({ userId }: ReportHazardFormProps) {
  const [eventDate, setEventDate] = useState<string>("")
  const [sourceType, setSourceType] = useState<string>("")
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [title, setTitle] = useState<string>("")
  const [details, setDetails] = useState<string>("")
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming?.length) return
    const list = Array.from(incoming)
    setFiles((prev) => {
      const keys = new Set(prev.map((f) => `${f.name}:${f.size}`))
      const merged = [...prev]
      for (const f of list) {
        const key = `${f.name}:${f.size}`
        if (!keys.has(key)) {
          keys.add(key)
          merged.push(f)
        }
      }
      return merged
    })
  }, [])

  const removeFileAt = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const pendingBytes = files.reduce((s, f) => s + f.size, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const dateParts = eventDate.split(".")
      if (dateParts.length !== 3) {
        setError("Invalid date format")
        setSubmitting(false)
        return
      }
      const [day, month, year] = dateParts
      const isoDate = `${year}-${month}-${day}`

      const formData = new FormData()
      formData.append("eventDate", isoDate)
      formData.append("sourceType", sourceType || "")
      formData.append("isAnonymous", String(isAnonymous))
      formData.append("title", title || "")
      formData.append("details", details || "")
      if (!isAnonymous) {
        formData.append("reportedBy", userId)
      }
      for (const file of files) {
        formData.append("files", file)
      }

      const response = await fetch("/api/hazard-reports", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit hazard report")
        return
      }

      const payload = await response.json().catch(() => ({}))
      if (payload._uploadStats?.failed > 0) {
        setError(
          `Report saved, but ${payload._uploadStats.failed} file(s) could not be uploaded (invalid type or size).`
        )
      } else {
        setSuccess(true)
      }

      setEventDate("")
      setSourceType("")
      setIsAnonymous(false)
      setTitle("")
      setDetails("")
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
      
      if (!payload?._uploadStats?.failed) {
        setTimeout(() => {
          setSuccess(false)
        }, 3000)
      }
    } catch (err) {
      console.error("Error submitting hazard report:", err)
      setError("An error occurred while submitting the report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Hazard Report</CardTitle>
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
                Hazard report submitted successfully!
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="eventDate" className="text-sm font-medium">
                Event Date
              </Label>
              <DatePickerLimited
                value={eventDate}
                onChange={setEventDate}
                placeholder="Select event date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceType" className="text-sm font-medium">
                Source Type
              </Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="sourceType" className="w-full">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="report-anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) =>
                  setIsAnonymous(checked === true)
                }
              />
              <Label
                htmlFor="report-anonymous"
                className="text-sm font-medium cursor-pointer"
              >
                Reported by Not Anonymous
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Please briefly describe the subject of your report..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details" className="text-sm font-medium">
                Details
              </Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Please write the details of your report. Do not omit any information that may be important."
                className="w-full min-h-[120px]"
              />
            </div>

            <div className="space-y-3 border-t pt-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Attachments (optional)</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Photos, videos, or documents (PDF, Word, Excel, PowerPoint). Up to
                    50 MB per file.
                  </p>
                </div>

                <Input
                  id="hazard-files"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={`image/*,video/*,${DOCUMENT_ACCEPT_HTML}`}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ""
                  }}
                />

                <label
                  htmlFor="hazard-files"
                  onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(false)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(false)
                    addFiles(e.dataTransfer.files)
                  }}
                  className={cn(
                    "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                    dragOver
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-muted-foreground/25 bg-muted/20 hover:border-primary/40 hover:bg-muted/35"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full",
                      dragOver ? "bg-primary/15" : "bg-muted"
                    )}
                  >
                    <IconUpload
                      className={cn(
                        "size-6",
                        dragOver ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-foreground text-sm font-medium">
                      Drag files here or click anywhere in this area
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Multiple files supported
                    </p>
                  </div>
                  <span className="bg-secondary text-secondary-foreground inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium shadow-sm">
                    Choose files
                  </span>
                </label>

                {files.length > 0 && (
                  <ul className="space-y-2">
                    {files.map((f, i) => {
                      const tooLarge = f.size > MAX_FILE_BYTES
                      return (
                        <li
                          key={`${f.name}-${f.size}-${i}`}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                            tooLarge
                              ? "border-destructive/40 bg-destructive/5"
                              : "bg-muted/50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{f.name}</p>
                            <p
                              className={cn(
                                "text-xs",
                                tooLarge
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              )}
                            >
                              {formatFileSize(f.size)}
                              {tooLarge ? " — exceeds 50 MB limit" : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={() => removeFileAt(i)}
                            aria-label={`Remove ${f.name}`}
                          >
                            <IconX className="size-4" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <p className="text-muted-foreground text-xs">
                  {files.length === 0
                    ? "No files selected yet."
                    : `${files.length} file${files.length === 1 ? "" : "s"} · ${formatFileSize(pendingBytes)} total`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !eventDate ||
                  files.some((f) => f.size > MAX_FILE_BYTES)
                }
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

