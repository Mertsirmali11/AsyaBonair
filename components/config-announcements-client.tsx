"use client"

import * as React from "react"
import {
  IconDownload,
  IconFileTypePdf,
  IconMailForward,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"

import {
  downloadAnnouncementReportPdf,
  downloadAnnouncementReportXlsx,
} from "@/lib/announcement-report-download"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type Creator = {
  isim: string | null
  soyisim: string | null
  departman: string | null
} | null

export type ConfigAnnouncement = {
  id: number
  title: string
  content: string
  isActive: boolean
  createdAt: string
  creator: Creator
  acknowledgedCount?: number
  totalStaff?: number
}

type AckStatsPayload = {
  totalStaff: number
  acknowledgedCount: number
  notAcknowledged: Array<{
    id: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    email: string
  }>
  acknowledged: Array<{
    calisanId: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    email: string
    acknowledgedAt: string
  }>
}

export function ConfigAnnouncementsClient({
  compactHeader = false,
}: {
  compactHeader?: boolean
}) {
  const [items, setItems] = React.useState<ConfigAnnouncement[]>([])
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")

  const [readItem, setReadItem] = React.useState<ConfigAnnouncement | null>(null)
  const [detailEditing, setDetailEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState("")
  const [editContent, setEditContent] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newContent, setNewContent] = React.useState("")
  /** false = taslak; dashboard’ta görünmez, e-posta gönderilmez */
  const [newActive, setNewActive] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [togglingActiveId, setTogglingActiveId] = React.useState<number | null>(null)

  const [deleteTarget, setDeleteTarget] = React.useState<ConfigAnnouncement | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const [ackStats, setAckStats] = React.useState<AckStatsPayload | null>(null)
  const [ackStatsLoading, setAckStatsLoading] = React.useState(false)
  const [emailReportSending, setEmailReportSending] = React.useState(false)
  const [exportingKey, setExportingKey] = React.useState<string | null>(null)

  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 4500)
    return () => window.clearTimeout(t)
  }, [banner])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/announcements", { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not load announcements")
      }
      const data = (await res.json()) as ConfigAnnouncement[]
      setItems(
        Array.isArray(data)
          ? data.map((x) => ({
              ...x,
              isActive: typeof x.isActive === "boolean" ? x.isActive : true,
            }))
          : []
      )
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load announcements",
      })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const openDetail = (a: ConfigAnnouncement) => {
    setReadItem(a)
    setDetailEditing(false)
    setEditTitle(a.title)
    setEditContent(a.content)
    setAckStats(null)
  }

  const closeDetail = () => {
    setReadItem(null)
    setDetailEditing(false)
    setEditTitle("")
    setEditContent("")
    setAckStats(null)
  }

  const detailAnnouncementId = readItem?.id

  React.useEffect(() => {
    if (detailAnnouncementId == null) return
    let cancelled = false
    setAckStatsLoading(true)
    void fetch(`/api/announcements/${detailAnnouncementId}/ack-stats`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as AckStatsPayload | null
        if (!cancelled && res.ok && data && typeof data.totalStaff === "number") {
          setAckStats(data)
        } else if (!cancelled) {
          setAckStats(null)
        }
      })
      .finally(() => {
        if (!cancelled) setAckStatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailAnnouncementId])

  const setAnnouncementActive = async (a: ConfigAnnouncement, next: boolean) => {
    setTogglingActiveId(a.id)
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string
          detail?: string
        }
        const msg = [err.error, err.detail].filter(Boolean).join(" — ")
        throw new Error(msg || "Could not update status")
      }
      const updated = (await res.json()) as ConfigAnnouncement & {
        acknowledgedCount?: number
        totalStaff?: number
      }
      setItems((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      )
      setReadItem((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev
      )
      setBanner({
        type: "ok",
        text: next
          ? "Announcement is active — visible on staff dashboards."
          : "Announcement is inactive — hidden from staff dashboards.",
      })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not update status",
      })
    } finally {
      setTogglingActiveId(null)
    }
  }

  const runExport = React.useCallback(
    async (format: "pdf" | "xlsx", a: ConfigAnnouncement) => {
      const key = `${a.id}-${format}`
      setExportingKey(key)
      try {
        let stats: AckStatsPayload | null =
          readItem?.id === a.id ? ackStats : null
        if (!stats) {
          const res = await fetch(`/api/announcements/${a.id}/ack-stats`, {
            cache: "no-store",
          })
          const data = (await res.json().catch(() => null)) as AckStatsPayload | null
          if (!res.ok || !data || typeof data.totalStaff !== "number") {
            throw new Error("Could not load acknowledgment data for export.")
          }
          stats = data
        }
        const payload = {
          id: a.id,
          title: a.title,
          content: a.content,
          createdAt: a.createdAt,
          creator: a.creator,
          stats,
        }
        if (format === "pdf") {
          downloadAnnouncementReportPdf(payload)
        } else {
          downloadAnnouncementReportXlsx(payload)
        }
      } catch (e) {
        setBanner({
          type: "err",
          text: e instanceof Error ? e.message : "Could not export report.",
        })
      } finally {
        setExportingKey(null)
      }
    },
    [ackStats, readItem?.id]
  )

  const sendAckReportEmail = async () => {
    if (!readItem) return
    setEmailReportSending(true)
    try {
      const res = await fetch(`/api/announcements/${readItem.id}/email-ack-report`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Could not send email.")
      }
      setBanner({
        type: "ok",
        text: "Report sent to your email (check inbox / spam).",
      })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not send email.",
      })
    } finally {
      setEmailReportSending(false)
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((a) => {
      const t = `${a.title} ${a.content}`.toLowerCase()
      const creator = a.creator
      const cName = creator
        ? `${creator.isim ?? ""} ${creator.soyisim ?? ""} ${creator.departman ?? ""}`.toLowerCase()
        : ""
      return t.includes(q) || cName.includes(q)
    })
  }, [items, query])

  const saveEdit = async () => {
    if (!readItem) return
    const title = editTitle.trim()
    const content = editContent.trim()
    if (!title || !content) {
      setBanner({ type: "err", text: "Title and content are required." })
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/announcements/${readItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not save changes")
      }
      const updated = (await res.json()) as ConfigAnnouncement
      setItems((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      )
      setReadItem((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev
      )
      setEditTitle(updated.title)
      setEditContent(updated.content)
      setDetailEditing(false)
      setBanner({ type: "ok", text: "Announcement updated." })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not save changes",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const submitCreate = async () => {
    const title = newTitle.trim()
    const content = newContent.trim()
    if (!title || !content) {
      setBanner({ type: "err", text: "Title and content are required." })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, isActive: newActive }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not create announcement")
      }
      const created = (await res.json()) as ConfigAnnouncement & {
        _emailDelivery?: unknown
      }
      setItems((prev) => [
        {
          id: created.id,
          title: created.title,
          content: created.content,
          isActive: typeof created.isActive === "boolean" ? created.isActive : newActive,
          createdAt: created.createdAt,
          creator: created.creator ?? null,
          acknowledgedCount: created.acknowledgedCount ?? 0,
          totalStaff: created.totalStaff,
        },
        ...prev,
      ])
      setCreateOpen(false)
      setNewTitle("")
      setNewContent("")
      setNewActive(true)
      setBanner({
        type: "ok",
        text: newActive
          ? "Announcement published. Staff were emailed where configured."
          : "Announcement saved as inactive. It is not shown on dashboards until you activate it.",
      })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not create announcement",
      })
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/announcements/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not delete")
      }
      setBanner({ type: "ok", text: "Announcement deleted." })
      setDeleteTarget(null)
      if (readItem?.id === deleteTarget.id) closeDetail()
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader && (
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Announcements</h2>
            <p className="text-muted-foreground text-sm">
              Create, view, edit, and delete announcements. Active posts appear on every staff
              dashboard (new employees see all current active items); inactive posts stay in this
              admin list only and are hidden from dashboards until you turn them active again. New
              active posts email all staff when Resend is configured. Staff confirm with “I have read
              and understood”. Same permissions as the dashboard (Quality / Human Resources).
            </p>
          </div>
        )}
        {compactHeader && (
          <p className="text-muted-foreground min-w-0 max-w-3xl flex-1 text-left text-sm leading-relaxed">
            Active announcements appear on staff dashboards; inactive ones stay in this list only.
          </p>
        )}
        <Button
          type="button"
          className={
            compactHeader
              ? "h-10 shrink-0 gap-2 self-start sm:self-center"
              : "shrink-0 gap-2 self-end sm:self-center"
          }
          variant="outline"
          onClick={() => {
            setCreateOpen(true)
            setNewTitle("")
            setNewContent("")
            setNewActive(true)
          }}
          disabled={loading}
        >
          <IconPlus className="size-4 shrink-0" />
          New announcement
        </Button>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {banner && (
            <div
              role="status"
              className={
                banner.type === "ok"
                  ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {banner.text}
            </div>
          )}
          <div className="relative">
            <IconSearch className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, body, or author…"
              className="pl-9"
              disabled={loading}
            />
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
              {items.length === 0
                ? "No announcements yet."
                : "No announcements match your search."}
            </p>
          ) : (
            <ScrollArea className="h-[min(70vh,640px)] pr-3">
              <ul className="flex flex-col gap-3">
                {filtered.map((a) => (
                  <li key={a.id}>
                    <Card className="transition-colors hover:bg-muted/30">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold leading-tight">{a.title}</p>
                            <Badge
                              variant={a.isActive ? "default" : "secondary"}
                              className={
                                a.isActive
                                  ? "border-emerald-600/30 bg-emerald-600 text-white"
                                  : "text-muted-foreground"
                              }
                            >
                              {a.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-sm whitespace-pre-wrap">
                            {a.content}
                          </p>
                          {typeof a.acknowledgedCount === "number" &&
                            typeof a.totalStaff === "number" && (
                              <p className="text-xs font-medium text-sky-800 dark:text-sky-200">
                                Acknowledged: {a.acknowledgedCount} / {a.totalStaff} staff
                              </p>
                            )}
                          <p className="text-muted-foreground text-xs">
                            {formatDateTimeIstanbul(a.createdAt)}
                            {a.creator && (
                              <>
                                {" · "}
                                {a.creator.isim} {a.creator.soyisim}
                                {a.creator.departman ? ` (${a.creator.departman})` : ""}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <div className="flex items-center justify-end gap-2 sm:justify-start">
                            <Label
                              htmlFor={`active-${a.id}`}
                              className="text-muted-foreground text-xs whitespace-nowrap"
                            >
                              Active
                            </Label>
                            <Switch
                              id={`active-${a.id}`}
                              size="sm"
                              checked={a.isActive}
                              disabled={togglingActiveId === a.id}
                              onCheckedChange={(v) => void setAnnouncementActive(a, v)}
                            />
                          </div>
                          <Button type="button" size="sm" onClick={() => openDetail(a)}>
                            Details
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={!!exportingKey?.startsWith(`${a.id}-`)}
                            onClick={() => void runExport("pdf", a)}
                          >
                            <IconFileTypePdf className="size-4 shrink-0" />
                            PDF
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={!!exportingKey?.startsWith(`${a.id}-`)}
                            onClick={() => void runExport("xlsx", a)}
                          >
                            <IconDownload className="size-4 shrink-0" />
                            Excel
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <IconTrash className="mr-1 size-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          {!loading && items.length > 0 && (
            <p className="text-muted-foreground text-center text-xs">
              {items.length} announcement{items.length === 1 ? "" : "s"}
              {query.trim() ? ` · ${filtered.length} shown` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!readItem}
        onOpenChange={(o) => {
          if (!o) closeDetail()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {detailEditing ? "Edit announcement" : "Announcement"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground space-y-2 text-left text-xs">
                {readItem && (
                  <>
                    <p>{formatDateTimeIstanbul(readItem.createdAt)}</p>
                    {readItem.creator && (
                      <p>
                        By {readItem.creator.isim} {readItem.creator.soyisim}
                        {readItem.creator.departman
                          ? ` · ${readItem.creator.departman}`
                          : ""}
                      </p>
                    )}
                    {!detailEditing && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                        <Badge
                          variant={readItem.isActive ? "default" : "secondary"}
                          className={
                            readItem.isActive
                              ? "border-emerald-600/30 bg-emerald-600 text-white"
                              : "text-muted-foreground"
                          }
                        >
                          {readItem.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`detail-active-${readItem.id}`}
                            className="text-foreground font-normal"
                          >
                            Show on staff dashboard
                          </Label>
                          <Switch
                            id={`detail-active-${readItem.id}`}
                            size="sm"
                            checked={readItem.isActive}
                            disabled={togglingActiveId === readItem.id}
                            onCheckedChange={(v) => void setAnnouncementActive(readItem, v)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {readItem && detailEditing ? (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-content">Content</Label>
                <Textarea
                  id="edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-40"
                  disabled={savingEdit}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {readItem && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Okuma / onay durumu</p>
                  {ackStatsLoading && (
                    <p className="text-muted-foreground mt-1 text-xs">Loading…</p>
                  )}
                  {!ackStatsLoading && ackStats && (
                    <>
                      <p className="mt-1 text-xs">
                        <strong>{ackStats.acknowledgedCount}</strong> /{" "}
                        <strong>{ackStats.totalStaff}</strong> staff selected “I have read and understood”.
                        {" · "}
                        <span className="text-amber-800 dark:text-amber-200">
                          {ackStats.notAcknowledged.length} staff not yet acknowledged
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={emailReportSending}
                          onClick={() => void sendAckReportEmail()}
                        >
                          <IconMailForward className="size-4" />
                          {emailReportSending
                            ? "Sending…"
                            : "Email me the full report"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={!!exportingKey?.startsWith(`${readItem.id}-`)}
                          onClick={() => void runExport("pdf", readItem)}
                        >
                          <IconFileTypePdf className="size-4" />
                          {exportingKey === `${readItem.id}-pdf`
                            ? "PDF…"
                            : "Download PDF"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={!!exportingKey?.startsWith(`${readItem.id}-`)}
                          onClick={() => void runExport("xlsx", readItem)}
                        >
                          <IconDownload className="size-4" />
                          {exportingKey === `${readItem.id}-xlsx`
                            ? "Excel…"
                            : "Download Excel"}
                        </Button>
                      </div>
                      {(ackStats.acknowledged?.length ?? 0) > 0 && (
                        <div className="mt-3 max-h-36 overflow-y-auto rounded border border-emerald-200/80 bg-emerald-50/50 p-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/25">
                          <p className="mb-1 font-medium text-emerald-800 dark:text-emerald-300">
                            Acknowledged
                          </p>
                          <ul className="list-inside list-disc space-y-0.5">
                            {ackStats.acknowledged.slice(0, 80).map((c) => (
                              <li key={c.calisanId}>
                                <span className="font-medium text-foreground">
                                  {c.isim} {c.soyisim}
                                </span>
                                {c.departman ? ` · ${c.departman}` : ""} — {c.email}
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {formatDateTimeIstanbul(c.acknowledgedAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {ackStats.acknowledged.length > 80 && (
                            <p className="text-muted-foreground mt-1">
                              … and {ackStats.acknowledged.length - 80} more (full list in
                              email)
                            </p>
                          )}
                        </div>
                      )}
                      {ackStats.notAcknowledged.length > 0 && (
                        <div className="mt-3 max-h-36 overflow-y-auto rounded border bg-background p-2 text-xs">
                          <p className="mb-1 font-medium text-destructive">
                            Not yet acknowledged
                          </p>
                          <ul className="list-inside list-disc space-y-0.5">
                            {ackStats.notAcknowledged.slice(0, 80).map((c) => (
                              <li key={c.id}>
                                {c.isim} {c.soyisim}
                                {c.departman ? ` · ${c.departman}` : ""} — {c.email}
                              </li>
                            ))}
                          </ul>
                          {ackStats.notAcknowledged.length > 80 && (
                            <p className="text-muted-foreground mt-1">
                              … and {ackStats.notAcknowledged.length - 80} more (full list in email)
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {!ackStatsLoading && !ackStats && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Could not load statistics.
                    </p>
                  )}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap">{readItem?.content}</div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={closeDetail} disabled={savingEdit}>
                Close
              </Button>
              {readItem && !detailEditing && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setDetailEditing(true)
                      setEditTitle(readItem.title)
                      setEditContent(readItem.content)
                    }}
                  >
                    <IconPencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setDeleteTarget(readItem)
                      closeDetail()
                    }}
                  >
                    Delete…
                  </Button>
                </>
              )}
              {readItem && detailEditing && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingEdit}
                    onClick={() => {
                      setDetailEditing(false)
                      setEditTitle(readItem.title)
                      setEditContent(readItem.content)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" disabled={savingEdit} onClick={() => void saveEdit()}>
                    {savingEdit ? "Saving…" : "Save changes"}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setNewTitle("")
            setNewContent("")
            setNewActive(true)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Active posts appear on every staff dashboard (including new employees) and are emailed
              to all addresses when Resend is configured. Turn off “Show on dashboard” to save as
              inactive — no email, hidden from dashboards until you activate it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={creating}
                placeholder="Short headline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-content">Content</Label>
              <Textarea
                id="new-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-40"
                disabled={creating}
                placeholder="Full message body"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="new-active" className="text-sm font-medium">
                  Show on dashboard (active)
                </Label>
                <p className="text-muted-foreground text-xs">
                  Inactive saves the announcement here only; staff will not see it yet.
                </p>
              </div>
              <Switch
                id="new-active"
                checked={newActive}
                onCheckedChange={setNewActive}
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? "Publishing…" : "Publish & email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete announcement?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Emails already sent cannot be recalled.
              {deleteTarget && (
                <span className="mt-2 block font-medium text-foreground">
                  “{deleteTarget.title}”
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
