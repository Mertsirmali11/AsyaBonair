"use client"

import * as React from "react"
import { IconDownload, IconSend } from "@tabler/icons-react"
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
  creator: {
    id: number
    isim: string | null
    soyisim: string | null
    email: string
    departman: string | null
  }
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

export function SupportTicketsClient() {
  const [tickets, setTickets] = React.useState<TicketRow[]>([])
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [subject, setSubject] = React.useState("")
  const [content, setContent] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<TicketRow | null>(null)
  const [editStatus, setEditStatus] = React.useState<TicketStatus>("OPEN")
  const [editAction, setEditAction] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)

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
      setTickets(Array.isArray(data.tickets) ? data.tickets : [])
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

  const submitTicket = async () => {
    const c = content.trim()
    if (!c) {
      setBanner({ type: "err", text: "Sorunun açıklamasını yazın." })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          content: c,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Gönderilemedi")
      setBanner({ type: "ok", text: "Destek talebiniz iletildi. Admin en kısa sürede aksiyon alacaktır." })
      setSubject("")
      setContent("")
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

      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Destek &amp; hata yönetimi
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Personelden gelen sistem hataları ve destek talepleri
        </p>
      </div>

      {isAdmin && !loading ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
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
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {isAdmin ? (
            <Card>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yeni destek talebi</CardTitle>
              <CardDescription>
                Yaşadığınız sorunu kısaca özetleyin; Admin bu kayıt üzerinden aksiyon alır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button
                type="button"
                className="gap-2"
                disabled={submitting}
                onClick={() => void submitTicket()}
              >
                <IconSend className="size-4" />
                {submitting ? "Gönderiliyor…" : "Talebi gönder"}
              </Button>
            </CardContent>
          </Card>

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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
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
