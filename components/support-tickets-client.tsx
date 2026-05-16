"use client"

import * as React from "react"
import {
  IconDownload,
  IconHistory,
  IconPaperclip,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"

type TicketAttachment = {
  id: number
  fileName: string
  mimeType: string
  sizeBytes: number
}

type TicketRow = {
  id: number
  subject: string | null
  content: string
  status: TicketStatus
  adminAction: string | null
  departmentSnapshot: string | null
  createdAt: string
  updatedAt: string
  createdBy: number
  attachments: TicketAttachment[]
  creator: {
    id: number
    isim: string | null
    soyisim: string | null
    email: string
    departman: string | null
  }
}

type HistoryAttachmentMeta = { fileName: string; sizeBytes: number }

type TicketHistoryEntry = {
  id: number
  createdAt: string
  eventType: string
  statusFrom: TicketStatus | null
  statusTo: TicketStatus | null
  adminNote: string | null
  subjectSnapshot: string | null
  contentSnapshot: string | null
  attachmentMeta: unknown
  actor: TicketRow["creator"]
}

const MAX_ATTACHMENTS = 5
const MAX_FILE_BYTES = 12 * 1024 * 1024

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentHref(ticketId: number, attachmentId: number): string {
  return `/api/support-tickets/${ticketId}/attachments/${attachmentId}/file`
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapatıldı",
}

function personelLabel(c: TicketRow["creator"]): string {
  const n = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  return n || c.email
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function parseAttachmentMeta(raw: unknown): HistoryAttachmentMeta[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is HistoryAttachmentMeta =>
      x !== null &&
      typeof x === "object" &&
      typeof (x as HistoryAttachmentMeta).fileName === "string" &&
      typeof (x as HistoryAttachmentMeta).sizeBytes === "number"
  )
}

function TicketAttachmentLinks({
  ticketId,
  items,
}: {
  ticketId: number
  items: TicketAttachment[]
}) {
  if (!items.length) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <IconPaperclip className="size-3.5 shrink-0" />
        Ekler
      </span>
      {items.map((a) => (
        <a
          key={a.id}
          href={attachmentHref(ticketId, a.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary max-w-[200px] truncate underline-offset-2 hover:underline"
          title={a.fileName}
        >
          {a.fileName}
        </a>
      ))}
    </div>
  )
}

export function SupportTicketsClient() {
  const [tickets, setTickets] = React.useState<TicketRow[]>([])
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [subject, setSubject] = React.useState("")
  const [content, setContent] = React.useState("")
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<TicketRow | null>(null)
  const [editStatus, setEditStatus] = React.useState<TicketStatus>("OPEN")
  const [editAction, setEditAction] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [ticketHistory, setTicketHistory] = React.useState<TicketHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/support-tickets", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        tickets?: TicketRow[]
        isAdmin?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Liste yüklenemedi")
      const list = Array.isArray(data.tickets) ? data.tickets : []
      setTickets(
        list.map((t) => ({
          ...t,
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
        }))
      )
      setIsAdmin(!!data.isAdmin)
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Liste yüklenemedi",
      })
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 7000)
    return () => window.clearTimeout(t)
  }, [banner])

  React.useEffect(() => {
    if (!editOpen || !editRow || !isAdmin) {
      setTicketHistory([])
      setHistoryLoading(false)
      return
    }

    let cancelled = false
    setHistoryLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/support-tickets/${editRow.id}`, {
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as {
          history?: TicketHistoryEntry[]
        }
        const list = Array.isArray(data.history) ? data.history : []
        if (!cancelled) setTicketHistory(list)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editOpen, editRow?.id, isAdmin])

  const addPendingFiles = (list: FileList | File[]) => {
    const next: File[] = [...pendingFiles]
    const arr = Array.from(list)
    for (const f of arr) {
      if (next.length >= MAX_ATTACHMENTS) break
      if (f.size > MAX_FILE_BYTES) {
        setBanner({
          type: "err",
          text: `Dosya çok büyük (en fazla ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB): ${f.name}`,
        })
        continue
      }
      const mime = (f.type || "").toLowerCase()
      const okMime =
        mime === "application/pdf" ||
        mime.startsWith("image/")
      const nameOk = /\.(pdf|jpe?g|png|webp|gif)$/i.test(f.name)
      if (!okMime && !nameOk) {
        setBanner({
          type: "err",
          text: "Yalnızca PDF veya görsel (JPEG, PNG, WebP, GIF) seçebilirsiniz.",
        })
        continue
      }
      next.push(f)
    }
    setPendingFiles(next)
  }

  const removePendingAt = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const submitTicket = async () => {
    const c = content.trim()
    if (!c) {
      setBanner({ type: "err", text: "Sorunun açıklamasını yazın." })
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("content", c)
      const sub = subject.trim()
      if (sub) fd.append("subject", sub)
      for (const f of pendingFiles) {
        fd.append("files", f)
      }
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Gönderilemedi")
      setBanner({ type: "ok", text: "Destek talebiniz iletildi. Admin en kısa sürede aksiyon alacaktır." })
      setSubject("")
      setContent("")
      setPendingFiles([])
      setCreateOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Gönderilemedi",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (row: TicketRow) => {
    setEditRow(row)
    setEditStatus(row.status)
    setEditAction(row.adminAction ?? "")
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editRow) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/support-tickets/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          adminAction: editAction,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi")
      setBanner({ type: "ok", text: "Talep güncellendi." })
      setEditOpen(false)
      setEditRow(null)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Kaydedilemedi",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const exportCsv = () => {
    const headers = [
      "ID",
      "Personel",
      "Departman",
      "Konu",
      "İçerik",
      "Oluşturulma",
      "Durum",
      "Admin aksiyonu",
    ]
    const rows = tickets.map((t) => [
      String(t.id),
      personelLabel(t.creator),
      t.departmentSnapshot ?? t.creator.departman ?? "",
      t.subject ?? "",
      t.content.replace(/\r?\n/g, " "),
      formatDateTimeIstanbul(t.createdAt),
      STATUS_LABEL[t.status],
      (t.adminAction ?? "").replace(/\r?\n/g, " "),
    ])
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((line) =>
          line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
        )
        .join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `destek-talepleri-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Destek &amp; hata yönetimi
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Personelden gelen sistem hataları ve destek talepleri
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
            Destek oluştur
          </Button>
          {isAdmin && !loading ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-emerald-600/50 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200"
              disabled={tickets.length === 0}
              onClick={() => exportCsv()}
            >
              <IconDownload className="size-4" />
              Excel&apos;e aktar (CSV)
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {isAdmin ? (
            <Card id="support-tickets-admin" className="scroll-mt-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tüm talepler (Admin)</CardTitle>
                <CardDescription>
                  Durum ve admin aksiyonunu güncellemek için satırdaki «İşlem»e tıklayın.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {tickets.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Kayıtlı destek talebi bulunamadı.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Personel</TableHead>
                        <TableHead>Departman</TableHead>
                        <TableHead className="max-w-[220px]">İçerik</TableHead>
                        <TableHead className="w-12 text-center">Ek</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="align-top font-medium">
                            {personelLabel(t.creator)}
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-sm">
                            {t.departmentSnapshot ?? t.creator.departman ?? "—"}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            <div className="text-foreground font-medium">
                              {t.subject ? `${t.subject} — ` : ""}
                              {truncate(t.content, 160)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-center text-xs">
                            {t.attachments.length > 0 ? t.attachments.length : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top whitespace-nowrap text-xs">
                            {formatDateTimeIstanbul(t.createdAt)}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {STATUS_LABEL[t.status]}
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(t)}
                            >
                              İşlem
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}

          {!isAdmin ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Taleplerim</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {tickets.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    Henüz talep göndermediniz.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Konu / özet</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="max-w-[280px]">Admin aksiyonu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="align-top text-sm">
                            <div className="font-medium">
                              {t.subject || "—"}
                            </div>
                            <p className="text-muted-foreground mt-1 line-clamp-3">
                              {t.content}
                            </p>
                            <TicketAttachmentLinks ticketId={t.id} items={t.attachments} />
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top whitespace-nowrap text-xs">
                            {formatDateTimeIstanbul(t.createdAt)}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {STATUS_LABEL[t.status]}
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-sm">
                            {t.adminAction?.trim() ? (
                              <span className="text-foreground whitespace-pre-wrap">
                                {t.adminAction}
                              </span>
                            ) : (
                              <span className="italic">Henüz not yok</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[min(90vh,calc(100vh-2rem))] gap-0 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni destek talebi</DialogTitle>
            <DialogDescription>
              Yaşadığınız sorunu kısaca özetleyin; Admin bu kayıt üzerinden aksiyon alır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="st-subject">Konu (isteğe bağlı)</Label>
              <Input
                id="st-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Örn. Giriş ekranı hatası"
                maxLength={200}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-content">Açıklama</Label>
              <Textarea
                id="st-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ne oldu, hangi sayfa, hata mesajı varsa yazın…"
                rows={5}
                className="min-h-[120px] resize-y"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-files">Ekler (isteğe bağlı)</Label>
              <p className="text-muted-foreground text-xs">
                Ekran görüntüsü veya PDF ekleyebilirsiniz. En fazla {MAX_ATTACHMENTS} dosya; dosya
                başına en fazla {Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB.
              </p>
              <Input
                id="st-files"
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
                onChange={(e) => {
                  const f = e.target.files
                  if (f?.length) addPendingFiles(f)
                  e.target.value = ""
                }}
              />
              {pendingFiles.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {pendingFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}-${f.size}`}
                      className="bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
                    >
                      <IconPaperclip className="text-muted-foreground size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate" title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatBytes(f.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removePendingAt(i)}
                        aria-label="Dosyayı kaldır"
                      >
                        <IconX className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => setCreateOpen(false)}
            >
              Kapat
            </Button>
            <Button type="button" className="gap-2" disabled={submitting} onClick={() => void submitTicket()}>
              <IconSend className="size-4" />
              {submitting ? "Gönderiliyor…" : "Talebi gönder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[min(92vh,calc(100vh-2rem))] gap-0 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Talep — Admin aksiyonu</DialogTitle>
            <DialogDescription>
              Talep #{editRow?.id} · {editRow ? personelLabel(editRow.creator) : ""}
            </DialogDescription>
          </DialogHeader>
          {editRow ? (
            <div className="space-y-3 py-2">
              <div className="bg-muted/50 max-h-32 overflow-y-auto rounded-md p-3 text-sm">
                <p className="text-muted-foreground text-xs font-medium">İçerik</p>
                <p className="mt-1 whitespace-pre-wrap">{editRow.content}</p>
              </div>
              {editRow.attachments.length > 0 ? (
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Personel ekleri
                  </p>
                  <ul className="space-y-1.5">
                    {editRow.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={attachmentHref(editRow.id, a.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                        >
                          <IconPaperclip className="size-4 shrink-0" />
                          <span className="break-all">{a.fileName}</span>
                          <span className="text-muted-foreground text-xs">
                            ({formatBytes(a.sizeBytes)})
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-md border border-border/80 bg-muted/20 p-3 text-sm">
                <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium">
                  <IconHistory className="size-4 shrink-0" aria-hidden />
                  Aksiyon geçmişi
                </div>
                {historyLoading ? (
                  <p className="text-muted-foreground text-xs">Geçmiş yükleniyor…</p>
                ) : ticketHistory.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Kayıtlı geçmiş yok (sistem güncellemesinden önce oluşturulmuş taleplerde ilk
                    kayıt yoktur).
                  </p>
                ) : (
                  <ul className="max-h-[min(40vh,280px)] space-y-3 overflow-y-auto overscroll-contain pr-1">
                    {ticketHistory.map((h) => {
                      const actorName = personelLabel(h.actor)
                      const time = formatDateTimeIstanbul(h.createdAt)
                      const isCreated = h.eventType === "CREATED"
                      const meta = isCreated ? parseAttachmentMeta(h.attachmentMeta) : []

                      return (
                        <li
                          key={h.id}
                          className="border-border/60 bg-background/80 rounded-md border px-2.5 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <span className="text-foreground font-semibold">
                              {isCreated ? "Talep oluşturuldu" : "Admin güncellemesi"}
                            </span>
                            <span className="text-muted-foreground tabular-nums">{time}</span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            <span className="text-foreground font-medium">{actorName}</span>
                            {h.actor.departman ? (
                              <span> · {h.actor.departman}</span>
                            ) : null}
                          </p>

                          {isCreated ? (
                            <div className="mt-2 space-y-2">
                              {h.subjectSnapshot?.trim() ? (
                                <p>
                                  <span className="text-muted-foreground">Konu: </span>
                                  <span className="text-foreground font-medium">
                                    {h.subjectSnapshot}
                                  </span>
                                </p>
                              ) : null}
                              {h.contentSnapshot?.trim() ? (
                                <div className="bg-muted/50 max-h-28 overflow-y-auto rounded p-2">
                                  <p className="text-muted-foreground mb-0.5 text-[10px] font-medium uppercase tracking-wide">
                                    Oluşturma anındaki açıklama
                                  </p>
                                  <p className="text-foreground whitespace-pre-wrap break-words">
                                    {h.contentSnapshot}
                                  </p>
                                </div>
                              ) : null}
                              {meta.length > 0 ? (
                                <div>
                                  <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
                                    Eklenen ekler (oluşturma)
                                  </p>
                                  <ul className="text-foreground space-y-0.5">
                                    {meta.map((m, i) => (
                                      <li key={`${m.fileName}-${i}`}>
                                        {m.fileName}{" "}
                                        <span className="text-muted-foreground">
                                          ({formatBytes(m.sizeBytes)})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {h.statusTo ? (
                                <p className="text-muted-foreground">
                                  İlk durum:{" "}
                                  <span className="text-foreground font-medium">
                                    {STATUS_LABEL[h.statusTo]}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              {h.statusFrom && h.statusTo && h.statusFrom !== h.statusTo ? (
                                <p className="text-foreground">
                                  Durum:{" "}
                                  <span className="font-medium">{STATUS_LABEL[h.statusFrom]}</span>
                                  <span className="text-muted-foreground"> → </span>
                                  <span className="font-medium">{STATUS_LABEL[h.statusTo]}</span>
                                </p>
                              ) : (
                                <p className="text-muted-foreground">
                                  Durum:{" "}
                                  <span className="text-foreground font-medium">
                                    {h.statusTo ? STATUS_LABEL[h.statusTo] : "—"}
                                  </span>
                                </p>
                              )}
                              {h.adminNote?.trim() ? (
                                <div className="bg-muted/50 rounded p-2">
                                  <p className="text-muted-foreground mb-0.5 text-[10px] font-medium uppercase tracking-wide">
                                    Bu adımda yazılan not
                                  </p>
                                  <p className="text-foreground whitespace-pre-wrap break-words">
                                    {h.adminNote}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-muted-foreground italic">
                                  Bu kayıtta yeni metin notu yok (yalnızca durum güncellendi).
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Durum</Label>
                <Select
                  value={editStatus}
                  onValueChange={(v) => setEditStatus(v as TicketStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="st-admin-action">Alınan aksiyon / not</Label>
                <Textarea
                  id="st-admin-action"
                  value={editAction}
                  onChange={(e) => setEditAction(e.target.value)}
                  placeholder="Yapılan işlem, yönlendirme, çözüm özeti…"
                  rows={5}
                  className="min-h-[100px] resize-y"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Kapat
            </Button>
            <Button type="button" disabled={savingEdit} onClick={() => void saveEdit()}>
              {savingEdit ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
