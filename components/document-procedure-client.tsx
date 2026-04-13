"use client"

import * as React from "react"
import { IconPlus, IconUpload } from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import { ALLOWED_DOCUMENT_TYPES_USER_MESSAGE } from "@/lib/allowed-document-uploads"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"

type Creator = {
  isim: string | null
  soyisim: string | null
  email: string
} | null

type CurrentRow = {
  id: number
  title: string
  slug: string
  revision: number
  contentText: string
  hasFile?: boolean
  originalFileName?: string | null
  fileMimeType?: string | null
  createdAt: string
  updatedAt: string
  creator: Creator
}

type HistoricMeta = {
  id: number
  title: string
  revision: number
  hasFile?: boolean
  originalFileName?: string | null
  fileMimeType?: string | null
  createdAt: string
  updatedAt: string
  creator: Creator
}

function isPdfMime(
  mime: string | null | undefined,
  fileName?: string | null
): boolean {
  const m = (mime ?? "").trim().toLowerCase()
  if (m === "application/pdf" || m.includes("pdf")) return true
  const n = (fileName ?? "").toLowerCase()
  return n.endsWith(".pdf")
}

function fileViewUrl(versionId: number): string {
  return `/api/document-procedure/${versionId}/file#view=FitH`
}

function formatCreator(c: Creator): string {
  if (!c) return "—"
  const name = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  if (name) return `${name} (${c.email})`
  return c.email
}

export function DocumentProcedureClient() {
  const [current, setCurrent] = React.useState<CurrentRow | null>(null)
  const [historic, setHistoric] = React.useState<HistoricMeta[]>([])
  const [canEdit, setCanEdit] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [addOpen, setAddOpen] = React.useState(false)
  const [title, setTitle] = React.useState("Document Procedure")
  const [revisionInput, setRevisionInput] = React.useState("0")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const [historicView, setHistoricView] = React.useState<{
    id: number
    title: string
    contentText: string
    hasFile?: boolean
    fileMimeType?: string | null
    originalFileName?: string | null
  } | null>(null)
  const [historicLoadingId, setHistoricLoadingId] = React.useState<
    number | null
  >(null)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 6000)
    return () => window.clearTimeout(t)
  }, [banner])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/document-procedure", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        current?: CurrentRow | null
        historicVersions?: HistoricMeta[]
        canEditDocumentProcedure?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Yüklenemedi")
      setCurrent(data.current ?? null)
      setHistoric(Array.isArray(data.historicVersions) ? data.historicVersions : [])
      setCanEdit(!!data.canEditDocumentProcedure)
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Yüklenemedi",
      })
      setCurrent(null)
      setHistoric([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!addOpen) return
    if (current) {
      setRevisionInput(String((current.revision ?? 0) + 1))
    } else {
      setRevisionInput("0")
    }
    setTitle("Document Procedure")
    setFile(null)
  }, [addOpen, current])

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revisionInput])

  const submit = async () => {
    const t = title.trim() || "Document Procedure"
    if (!file) {
      setBanner({
        type: "err",
        text: `Dosya gerekli (${ALLOWED_DOCUMENT_TYPES_USER_MESSAGE}).`,
      })
      return
    }
    if (!revisionNumberValid) {
      setBanner({
        type: "err",
        text: "Revizyon 0–999999 arasında tam sayı olmalıdır.",
      })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (current) {
        fd.append("supersedesId", String(current.id))
      }
      const res = await fetch("/api/document-procedure", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız")
      setBanner({ type: "ok", text: "Document Procedure güncellendi." })
      setAddOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Kayıt başarısız",
      })
    } finally {
      setUploading(false)
    }
  }

  const openHistoric = async (id: number) => {
    setHistoricLoadingId(id)
    try {
      const res = await fetch(`/api/document-procedure/${id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        version?: {
          id: number
          title: string
          contentText: string
          hasFile?: boolean
          fileMimeType?: string | null
          originalFileName?: string | null
        }
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Açılamadı")
      if (!data.version) throw new Error("Kayıt yok")
      setHistoricView({
        id: data.version.id,
        title: data.version.title,
        contentText: data.version.contentText,
        hasFile: data.version.hasFile,
        fileMimeType: data.version.fileMimeType,
        originalFileName: data.version.originalFileName,
      })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Açılamadı",
      })
    } finally {
      setHistoricLoadingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Kurumsal Document Procedure tek belgedir;{" "}
          <strong className="text-foreground">herkes</strong> güncel dosyayı PDF
          önizlemesi veya indirme ile görür.{" "}
          <strong className="text-foreground">Quality</strong> ve{" "}
          <strong className="text-foreground">Admin</strong> yeni sürüm yükleyebilir.
        </p>
        {canEdit ? (
          <Button
            type="button"
            className="shrink-0 gap-2"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus className="size-4" />
            Sürüm yükle
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !current ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Henüz yüklenmedi</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {canEdit
              ? "İlk sürümü yüklemek için «Sürüm yükle» düğmesini kullanın; mevcut kurumsal revizyon numaranızı (ör. 3, 5) girebilirsiniz."
              : "Quality veya Admin henüz belgeyi yüklememiş."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base leading-snug">{current.title}</CardTitle>
            <p className="text-muted-foreground text-xs">
              Rev. {current.revision} · {formatDateTimeIstanbul(current.updatedAt)} ·{" "}
              {formatCreator(current.creator)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.hasFile ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="default" size="sm" asChild>
                    <a
                      href={fileViewUrl(current.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Yeni sekmede aç
                    </a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`/api/document-procedure/${current.id}/file?download=1`}
                    >
                      İndir
                      {current.originalFileName
                        ? ` (${current.originalFileName})`
                        : ""}
                    </a>
                  </Button>
                </div>
                {isPdfMime(current.fileMimeType, current.originalFileName) ? (
                  <iframe
                    title={current.title}
                    src={fileViewUrl(current.id)}
                    className="min-h-[min(78vh,720px)] w-full rounded-md border border-border bg-background"
                  />
                ) : (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Bu dosya türü tarayıcıda gömülü önizlenemez. Görüntülemek için
                    «Yeni sekmede aç» veya dosyayı indirin.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3 rounded-md border border-amber-500/35 bg-amber-500/5 p-4">
                <p className="text-sm text-foreground">
                  Bu sürümde PDF dosyası yok (yalnızca eski metin kaydı). Sayfa
                  üzerinde düzenli PDF görünümü için güncel dosyayı{" "}
                  <strong className="font-medium">
                    PDF olarak «Sürüm yükle»
                  </strong>
                  ile yeniden yükleyin; yüklemeden sonra belge burada gömülü
                  PDF olarak açılır.
                </p>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => setAddOpen(true)}
                  >
                    <IconUpload className="size-4" />
                    PDF sürümü yükle
                  </Button>
                ) : null}
                <details className="group text-sm">
                  <summary className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline">
                    Çıkarılmış metin yedeği (salt okunur, isteğe bağlı)
                  </summary>
                  <pre className="mt-3 max-h-[min(40vh,360px)] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
                    {current.contentText}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && historic.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Önceki sürümler</CardTitle>
            <p className="text-muted-foreground text-sm">
              Yalnızca Quality ve Admin listeler; sürümü açarak PDF önizlemesi veya
              indirme kullanılabilir.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {historic.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  Rev. {h.revision} · {formatDateTimeIstanbul(h.updatedAt)} ·{" "}
                  {formatCreator(h.creator)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={historicLoadingId === h.id}
                  onClick={() => void openHistoric(h.id)}
                >
                  {historicLoadingId === h.id ? "Yükleniyor…" : "Görüntüle"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={!!historicView} onOpenChange={(o) => !o && setHistoricView(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 text-left">
            <DialogTitle>{historicView?.title ?? "Arşiv"}</DialogTitle>
            <DialogDescription>
              Eski sürüm — önizleme veya indirme (salt okunur)
            </DialogDescription>
          </DialogHeader>
          {historicView ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-2">
              {historicView.hasFile ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="default" size="sm" asChild>
                      <a
                        href={fileViewUrl(historicView.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Yeni sekmede aç
                      </a>
                    </Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a
                        href={`/api/document-procedure/${historicView.id}/file?download=1`}
                      >
                        İndir
                      </a>
                    </Button>
                  </div>
                  {isPdfMime(
                    historicView.fileMimeType,
                    historicView.originalFileName
                  ) ? (
                    <iframe
                      title={historicView.title}
                      src={fileViewUrl(historicView.id)}
                      className="min-h-[55vh] w-full rounded-md border border-border bg-background"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Bu dosya türü için önizleme yok; yeni sekmede açın veya indirin.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3 rounded-md border border-amber-500/35 bg-amber-500/5 p-4">
                  <p className="text-sm text-foreground">
                    Bu arşiv satırında PDF yok (eski kayıt). Gömülü PDF için
                    güncel sürümü PDF olarak yükleyin.
                  </p>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline">
                      Çıkarılmış metin yedeği
                    </summary>
                    <pre className="mt-3 max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                      {historicView.contentText}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" onClick={() => setHistoricView(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Document Procedure — sürüm yükle</DialogTitle>
            <DialogDescription>
              {current
                ? "Yeni revizyon: güncel sürüm (Rev. " +
                  current.revision +
                  ") arşive alınır; aşağıdaki numara yeni güncel sürüm olur."
                : "Sisteme ilk kez eklerken, elinizdeki belgenin güncel revizyon numarasını girin (ör. 3 veya 10)."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {current ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <strong className="font-medium">Yeni revizyon</strong> — Yerine
                geçilecek güncel kayıt: Rev. {current.revision} · {current.title}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Sistemde henüz Document Procedure kaydı yok; bu yükleme ilk sürüm
                olacaktır.
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="dp-title">Başlık</Label>
              <Input
                id="dp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dp-rev">Revizyon numarası</Label>
              <Input
                id="dp-rev"
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                inputMode="numeric"
                placeholder={current ? undefined : "Örn. 3 (mevcut belge rev.)"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dp-file">Dosya</Label>
              <Input
                id="dp-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={uploading}
              onClick={() => void submit()}
            >
              <IconUpload className="size-4" />
              {uploading ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
