"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconFileTypePdf,
  IconPhoto,
  IconVideo,
  IconExternalLink,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type HazardAttachmentRow = {
  id: number
  fileName: string
  mimeType: string
  kind: string
  createdAt: string
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "image") return <IconPhoto className="h-5 w-5 text-slate-600" />
  if (kind === "video") return <IconVideo className="h-5 w-5 text-slate-600" />
  return <IconFileTypePdf className="h-5 w-5 text-slate-600" />
}

export function HazardInboxAttachmentsView({ reportId }: { reportId: string }) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [attachments, setAttachments] = React.useState<HazardAttachmentRow[]>(
    []
  )

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/hazard-reports/${reportId}/attachments`)
        if (!res.ok) {
          if (res.status === 401) {
            setError("You must be signed in to view attachments.")
          } else if (res.status === 403) {
            setError("You do not have permission to view these attachments.")
          } else if (res.status === 404) {
            setError("Report not found.")
          } else {
            setError("Could not load attachments.")
          }
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setAttachments(data.attachments ?? [])
        }
      } catch {
        if (!cancelled) setError("Could not load attachments.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportId])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/hazard-inbox">
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Back to inbox
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Attachments</CardTitle>
          <CardDescription>
            Files submitted with hazard report #{reportId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && attachments.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No files were uploaded for this report.
            </p>
          )}
          {!loading && !error && attachments.length > 0 && (
            <ul className="divide-y rounded-md border">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 first:rounded-t-md last:rounded-b-md hover:bg-muted/30"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <KindIcon kind={a.kind} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.mimeType}
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" asChild>
                    <a
                      href={`/api/hazard-reports/attachments/${a.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1"
                    >
                      Open
                      <IconExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
