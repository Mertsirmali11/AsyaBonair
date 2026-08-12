"use client"

import * as React from "react"
import Image from "next/image"
import { toast } from "sonner"
import { AlertTriangle, FileText, Loader2, Paperclip, Send, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FINDING_FILE_ACCEPT_HTML, FINDING_FILE_TYPES_USER_MESSAGE } from "@/lib/allowed-document-uploads"
import { uploadAuditResponseFilesDirect } from "@/lib/client-audit-response-upload"
import { cn } from "@/lib/utils"

type AuditSummary = {
  auditNumber: string
  field: string
  description: string | null
  plannedDate: string
}

type NoteRow = { id: number; note: string; submitterName: string | null; submittedAt: string }
type FileRow = { id: number; fileName: string; fileSizeBytes: number | null; submitterName: string | null; createdAt: string }

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entry: AuditSummary; notes: NoteRow[]; files: FileRow[] }

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

export function AuditResponsePublicClient({ token }: { token: string }) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" })

  // Gönderen bilgisi — not ve dosya formu ortak kullanır, hata durumunda kaybolmaz.
  const [submitterName, setSubmitterName] = React.useState("")
  const [submitterEmail, setSubmitterEmail] = React.useState("")

  const [noteText, setNoteText] = React.useState("")
  const [submittingNote, setSubmittingNote] = React.useState(false)
  const [noteError, setNoteError] = React.useState<string | null>(null)

  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch(`/api/audit-response/${token}`, { cache: "no-store" })
      const data = (await parseJson(res)) as
        | { ok: true; entry: AuditSummary; notes: NoteRow[]; files: FileRow[] }
        | { ok: false; message?: string }
        | null
      if (!res.ok || !data || data.ok !== true) {
        setState({ status: "error", message: (data && "message" in data && data.message) || "Bu bağlantı kullanılamıyor." })
        return
      }
      setState({ status: "ready", entry: data.entry, notes: data.notes, files: data.files })
    } catch {
      setState({ status: "error", message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin." })
    }
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load])

  const nameOk = submitterName.trim().length > 0

  const submitNote = async () => {
    setNoteError(null)
    if (!nameOk) {
      setNoteError("İsim zorunludur.")
      return
    }
    if (!noteText.trim()) {
      setNoteError("Not metni zorunludur.")
      return
    }
    setSubmittingNote(true)
    try {
      const res = await fetch(`/api/audit-response/${token}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: noteText.trim(),
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim() || undefined,
        }),
      })
      const data = (await parseJson(res)) as { error?: string; id?: number; submittedAt?: string } | null
      if (!res.ok || !data) {
        throw new Error((data && data.error) || "Not gönderilemedi. Lütfen tekrar deneyin.")
      }
      // Yalnızca başarıda temizle — girilen metin hata durumunda kaybolmaz.
      setNoteText("")
      toast.success("Notunuz gönderildi.")
      if (state.status === "ready") {
        setState({
          ...state,
          notes: [{ id: data.id!, note: noteText.trim(), submitterName: submitterName.trim(), submittedAt: data.submittedAt! }, ...state.notes],
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Not gönderilemedi. Lütfen tekrar deneyin."
      setNoteError(message)
      toast.error(message)
    } finally {
      setSubmittingNote(false)
    }
  }

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)])
    setFileError(null)
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const submitFiles = async () => {
    setFileError(null)
    if (!nameOk) {
      setFileError("İsim zorunludur.")
      return
    }
    if (pendingFiles.length === 0) {
      setFileError("Lütfen en az bir dosya seçin.")
      return
    }
    setUploadingFiles(true)
    try {
      const uploaded = await uploadAuditResponseFilesDirect(token, pendingFiles)
      const res = await fetch(`/api/audit-response/${token}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: uploaded.map((u) => ({ path: u.path, fileName: u.fileName, mimeType: u.mimeType, sizeBytes: u.sizeBytes })),
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim() || undefined,
        }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) {
        throw new Error((data && data.error) || "Dosyalar yüklenemedi. Lütfen tekrar deneyin.")
      }
      toast.success(`${uploaded.length} dosya gönderildi.`)
      // Yalnızca başarıda temizle — hata durumunda seçili dosyalar korunur, kullanıcı yeniden denesin.
      setPendingFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (state.status === "ready") {
        setState({
          ...state,
          files: [
            ...uploaded.map((u, i) => ({
              id: -1 - i,
              fileName: u.fileName,
              fileSizeBytes: u.sizeBytes,
              submitterName: submitterName.trim(),
              createdAt: new Date().toISOString(),
            })),
            ...state.files,
          ],
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Dosyalar yüklenemedi. Lütfen tekrar deneyin."
      setFileError(message)
      toast.error(message)
    } finally {
      setUploadingFiles(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <div className="rounded-lg border border-border bg-background px-12 py-4">
            <Image src="/logo-bonjour.png" alt="Bonjour Logo" width={180} height={45} className="h-auto w-auto" priority />
          </div>
        </div>

        {state.status === "loading" && (
          <Card className="border-border shadow-sm">
            <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Yükleniyor…
            </CardContent>
          </Card>
        )}

        {state.status === "error" && (
          <Card className="border-destructive/30 shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </CardContent>
          </Card>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Audit Response</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Audit Number</p>
                    <p className="font-mono text-sm font-semibold">{state.entry.auditNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Audit Type / Field</p>
                    <p className="text-sm">{state.entry.field}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Planned Date</p>
                    <p className="text-sm">{new Date(state.entry.plannedDate).toLocaleDateString("tr-TR")}</p>
                  </div>
                </div>
                {state.entry.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Description</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.entry.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Your Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="submitter-name">Name *</Label>
                  <Input id="submitter-name" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Adınız Soyadınız" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="submitter-email">Email (optional)</Label>
                  <Input id="submitter-email" type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="ornek@sirket.com" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> Notes / Remarks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Notunuzu / açıklamanızı yazın…"
                  className="min-h-[100px]"
                  disabled={submittingNote}
                />
                {noteError && <p className="text-sm text-destructive">{noteError}</p>}
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void submitNote()} disabled={submittingNote}>
                    {submittingNote ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
                    Submit Note
                  </Button>
                </div>
                {state.notes.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Previously submitted</p>
                    <ul className="space-y-2 max-h-56 overflow-y-auto">
                      {state.notes.map((n) => (
                        <li key={n.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                          <p className="whitespace-pre-wrap">{n.note}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {n.submitterName ?? "—"} · {formatDate(n.submittedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="size-4" /> File Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label
                  htmlFor="audit-response-file-input"
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40",
                    uploadingFiles && "pointer-events-none opacity-50"
                  )}
                >
                  <Upload className="size-5" />
                  <span>Dosya seçmek için tıklayın</span>
                  <span className="text-xs">{FINDING_FILE_TYPES_USER_MESSAGE}</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="audit-response-file-input"
                  type="file"
                  multiple
                  accept={FINDING_FILE_ACCEPT_HTML}
                  className="hidden"
                  disabled={uploadingFiles}
                  onChange={(e) => addFiles(e.target.files)}
                />
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                        <span className="min-w-0 truncate">{f.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                          <button type="button" onClick={() => removePendingFile(i)} disabled={uploadingFiles} className="text-muted-foreground hover:text-destructive">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {fileError && <p className="text-sm text-destructive">{fileError}</p>}
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void submitFiles()} disabled={uploadingFiles || pendingFiles.length === 0}>
                    {uploadingFiles ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
                    Upload Files
                  </Button>
                </div>
                {state.files.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Previously submitted</p>
                    <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                      {state.files.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                          <span className="min-w-0 truncate">{f.fileName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {f.submitterName ?? "—"} · {formatDate(f.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
