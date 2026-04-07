"use client"

import * as React from "react"
import { IconTrash, IconUpload } from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import { DOCUMENT_ACCEPT_HTML } from "@/lib/allowed-document-uploads"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

type ManualRow = {
  id: number
  title: string
  slug: string
  updatedAt: string
}

export function ConfigManualsClient() {
  const [items, setItems] = React.useState<ManualRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [title, setTitle] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/manuals", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        manuals?: ManualRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not load list")
      setItems(Array.isArray(data.manuals) ? data.manuals : [])
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load list",
      })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    const t = title.trim()
    if (!t || !file) {
      setBanner({
        type: "err",
        text: "Enter a title and choose a file (PDF, Word, Excel, or PowerPoint).",
      })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("file", file)
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setBanner({
        type: "ok",
        text: "Manual saved. It can be selected in AI chat.",
      })
      setTitle("")
      setFile(null)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Upload failed",
      })
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this manual?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not delete")
      setBanner({ type: "ok", text: "Manual deleted." })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {banner && (
        <div
          role="status"
          className={
            banner.type === "ok"
              ? "rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
              : "rounded-lg border border-destructive/40 bg-background px-4 py-3 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload manual file</CardTitle>
          <CardDescription>
            For example, Compliance Monitoring Manual. Text is extracted from PDF or Office files;
            when selected in AI chat, answers are grounded in that content.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="manual-title">Manual title</Label>
            <Input
              id="manual-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Compliance Monitoring Manual"
              disabled={uploading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-file">File (PDF, Word, Excel, PowerPoint)</Label>
            <Input
              id="manual-file"
              type="file"
              accept={DOCUMENT_ACCEPT_HTML}
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="button"
            disabled={uploading || !title.trim() || !file}
            className="w-fit gap-2"
            onClick={() => void submit()}
          >
            <IconUpload className="size-4" />
            {uploading ? "Uploading…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded manuals</CardTitle>
          <CardDescription>
            Shown in the picker in Bonair AI chat. All staff can see the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No manuals yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTimeIstanbul(m.updatedAt)} · {m.slug}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={deletingId === m.id}
                    onClick={() => void remove(m.id)}
                    aria-label="Delete"
                  >
                    <IconTrash className="size-4" />
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
