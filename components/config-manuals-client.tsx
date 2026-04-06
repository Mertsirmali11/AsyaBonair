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
      if (!res.ok) throw new Error(data.error || "Liste alınamadı")
      setItems(Array.isArray(data.manuals) ? data.manuals : [])
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Liste alınamadı",
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
      setBanner({ type: "err", text: "Başlık ve dosya seçin (PDF, Word, Excel, PowerPoint)." })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("file", file)
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız")
      setBanner({ type: "ok", text: "Manuel kaydedildi. AI sohbette seçilebilir." })
      setTitle("")
      setFile(null)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Yükleme başarısız",
      })
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Bu manueli silmek istediğinize emin misiniz?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Silinemedi")
      setBanner({ type: "ok", text: "Manuel silindi." })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Silinemedi",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {banner && (
        <div
          role="status"
          className={
            banner.type === "ok"
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100"
              : "rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manuel dosyası yükle</CardTitle>
          <CardDescription>
            Örn. Compliance Monitoring Manual. Metin PDF veya Office dosyasından çıkarılır; AI sohbette
            seçildiğinde yanıtlar bu metne dayanır.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="manual-title">Manuel adı</Label>
            <Input
              id="manual-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Compliance Monitoring Manual"
              disabled={uploading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-file">Dosya (PDF, Word, Excel, PowerPoint)</Label>
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
            {uploading ? "Yükleniyor…" : "Kaydet"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yüklenen manueler</CardTitle>
          <CardDescription>
            Bonair AI sohbetinde açılır listeden seçilir. Tüm çalışanlar listeyi görebilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz manuel yok.</p>
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
                    aria-label="Sil"
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
