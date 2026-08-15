"use client"

import * as React from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Upload,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FINDING_FILE_ACCEPT_HTML, FINDING_FILE_TYPES_USER_MESSAGE } from "@/lib/allowed-document-uploads"
import { uploadAuditResponseFilesDirect } from "@/lib/client-audit-response-upload"
import { uploadAuditResponseChecklistFilesDirect } from "@/lib/client-audit-response-checklist-upload"
import { RESULT_KEYS, RESULT_LABELS, type ResultKey } from "@/lib/audit-checklist-result"
import { cn } from "@/lib/utils"

type AuditSummary = {
  auditNumber: string
  field: string
  description: string | null
  plannedDate: string
}

type NoteRow = { id: number; note: string; submitterName: string | null; submittedAt: string }
type FileRow = { id: number; fileName: string; fileSizeBytes: number | null; submitterName: string | null; createdAt: string }

type ChecklistSubmissionRow = {
  id: number
  /** S | U | NA | OBS | null */
  auditeeResponse: string | null
  auditeeNote: string | null
  reviewStatus: string
  reviewNote: string | null
  submittedAt: string
  files: { id: number; fileName: string; fileSizeBytes: number | null }[]
}
type ChecklistItemRow = {
  checklistItemId: number
  label: string
  reference: string | null
  section: string | null
  submissions: ChecklistSubmissionRow[]
}
type ChecklistSessionRow = {
  checklistId: number
  checklistTitle: string
  checklistNumber: string | null
  items: ChecklistItemRow[]
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      entry: AuditSummary
      notes: NoteRow[]
      files: FileRow[]
      checklistSessions: ChecklistSessionRow[]
    }

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

function reviewStatusBadge(status: string) {
  if (status === "Accepted") {
    return (
      <Badge className="gap-1 bg-teal-600 text-white hover:bg-teal-600">
        <CheckCircle2 className="size-3" /> Kabul Edildi
      </Badge>
    )
  }
  if (status === "RevisionRequested") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" /> Revizyon Talep Edildi
      </Badge>
    )
  }
  if (status === "Resubmitted") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400">
        <Loader2 className="size-3" /> Tekrar Gönderildi
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Loader2 className="size-3" /> İnceleme Bekliyor
    </Badge>
  )
}

export function AuditResponsePublicClient({ token }: { token: string }) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" })

  // Gönderen bilgisi — genel not ve genel dosya formu ortak kullanır, hata durumunda kaybolmaz.
  const [submitterName, setSubmitterName] = React.useState("")
  const [submitterEmail, setSubmitterEmail] = React.useState("")

  const [noteText, setNoteText] = React.useState("")
  const [submittingNote, setSubmittingNote] = React.useState(false)
  const [noteError, setNoteError] = React.useState<string | null>(null)

  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Checklist — soru başına cevap/not/dosya formu (checklistItemId -> form state)
  type ChecklistFormState = { result: ResultKey | ""; note: string; files: File[] }
  const [checklistForms, setChecklistForms] = React.useState<Record<number, ChecklistFormState>>({})
  const [checklistSubmitting, setChecklistSubmitting] = React.useState<Record<number, boolean>>({})
  const [checklistErrors, setChecklistErrors] = React.useState<Record<number, string>>({})
  // Bir soru için form ilk kez açıldığında (henüz kullanıcı hiçbir şey değiştirmediyse) hangi
  // gönderimden prefill edildiğini takip eder — RevisionRequested durumunda önceki cevap/notu
  // otomatik doldurmak için (kullanıcı sıfırdan yazmak zorunda kalmaz).
  const prefillDoneRef = React.useRef<Set<number>>(new Set())

  const getChecklistForm = (checklistItemId: number): ChecklistFormState =>
    checklistForms[checklistItemId] ?? { result: "", note: "", files: [] }

  const updateChecklistForm = (checklistItemId: number, patch: Partial<ChecklistFormState>) => {
    setChecklistForms((prev) => ({ ...prev, [checklistItemId]: { ...getChecklistForm(checklistItemId), ...patch } }))
  }

  const load = React.useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch(`/api/audit-response/${token}`, { cache: "no-store" })
      const data = (await parseJson(res)) as
        | { ok: true; entry: AuditSummary; notes: NoteRow[]; files: FileRow[]; checklistSessions?: ChecklistSessionRow[] }
        | { ok: false; message?: string }
        | null
      if (!res.ok || !data || data.ok !== true) {
        setState({ status: "error", message: (data && "message" in data && data.message) || "Bu bağlantı kullanılamıyor." })
        return
      }
      setState({
        status: "ready",
        entry: data.entry,
        notes: data.notes,
        files: data.files,
        checklistSessions: data.checklistSessions ?? [],
      })
    } catch {
      setState({ status: "error", message: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin." })
    }
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load])

  // RevisionRequested durumundaki sorular için formu otomatik olarak önceki cevap/notla
  // doldur — auditee sıfırdan yazmak yerine güncelleyip yeniden gönderebilsin.
  React.useEffect(() => {
    if (state.status !== "ready") return
    for (const session of state.checklistSessions) {
      for (const item of session.items) {
        const latest = item.submissions[0]
        if (
          latest &&
          latest.reviewStatus === "RevisionRequested" &&
          !prefillDoneRef.current.has(item.checklistItemId) &&
          !checklistForms[item.checklistItemId]
        ) {
          prefillDoneRef.current.add(item.checklistItemId)
          const r = latest.auditeeResponse
          setChecklistForms((prev) => ({
            ...prev,
            [item.checklistItemId]: {
              result: (r && (RESULT_KEYS as readonly string[]).includes(r) ? (r as ResultKey) : ""),
              note: latest.auditeeNote ?? "",
              files: [],
            },
          }))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const nameOk = submitterName.trim().length > 0

  const submitNote = async () => {
    setNoteError(null)
    if (!nameOk) {
      setNoteError("Ad Soyad zorunludur.")
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
      setFileError("Ad Soyad zorunludur.")
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

  const submitChecklistItem = async (checklistItemId: number) => {
    setChecklistErrors((prev) => ({ ...prev, [checklistItemId]: "" }))
    if (!nameOk) {
      setChecklistErrors((prev) => ({ ...prev, [checklistItemId]: "Ad Soyad zorunludur (yukarıdaki 'Bilgileriniz' bölümü)." }))
      return
    }
    const form = getChecklistForm(checklistItemId)
    if (!form.result && !form.note.trim() && form.files.length === 0) {
      setChecklistErrors((prev) => ({ ...prev, [checklistItemId]: "Cevap, not veya dosyalardan en az biri girilmelidir." }))
      return
    }
    setChecklistSubmitting((prev) => ({ ...prev, [checklistItemId]: true }))
    try {
      const uploaded =
        form.files.length > 0
          ? await uploadAuditResponseChecklistFilesDirect(token, checklistItemId, form.files)
          : []
      const res = await fetch(`/api/audit-response/${token}/checklist/${checklistItemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: form.result || undefined,
          auditeeNote: form.note.trim() || undefined,
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim() || undefined,
          files: uploaded.map((u) => ({ path: u.path, fileName: u.fileName, mimeType: u.mimeType, sizeBytes: u.sizeBytes })),
        }),
      })
      const data = (await parseJson(res)) as { error?: string; submission?: ChecklistSubmissionRow } | null
      if (!res.ok || !data || !data.submission) {
        throw new Error((data && data.error) || "Gönderilemedi. Lütfen tekrar deneyin.")
      }
      toast.success("Cevabınız gönderildi. Denetçi onayı bekleniyor.")
      updateChecklistForm(checklistItemId, { result: "", note: "", files: [] })
      if (state.status === "ready") {
        setState({
          ...state,
          checklistSessions: state.checklistSessions.map((s) => ({
            ...s,
            items: s.items.map((it) =>
              it.checklistItemId === checklistItemId
                ? { ...it, submissions: [data.submission!, ...it.submissions] }
                : it
            ),
          })),
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gönderilemedi. Lütfen tekrar deneyin."
      setChecklistErrors((prev) => ({ ...prev, [checklistItemId]: message }))
      toast.error(message)
    } finally {
      setChecklistSubmitting((prev) => ({ ...prev, [checklistItemId]: false }))
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
                <CardTitle className="text-xl">Denetim Yanıtı</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Denetim No</p>
                    <p className="font-mono text-sm font-semibold">{state.entry.auditNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Denetim Türü / Alan</p>
                    <p className="text-sm">{state.entry.field}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Planlanan Tarih</p>
                    <p className="text-sm">{new Date(state.entry.plannedDate).toLocaleDateString("tr-TR")}</p>
                  </div>
                </div>
                {state.entry.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Açıklama</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.entry.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Bilgileriniz</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="submitter-name">Ad Soyad *</Label>
                  <Input id="submitter-name" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Adınız Soyadınız" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="submitter-email">E-posta (İsteğe Bağlı)</Label>
                  <Input id="submitter-email" type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="ornek@sirket.com" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> Genel Not / Açıklama
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
                    Notu Gönder
                  </Button>
                </div>
                {state.notes.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Önceden gönderilenler</p>
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
                  <Paperclip className="size-4" /> Genel Dosyalar
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
                    Dosyaları Yükle
                  </Button>
                </div>
                {state.files.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Önceden gönderilenler</p>
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

            {state.checklistSessions.map((session) => (
              <Card key={session.checklistId} className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="size-4" />
                    {session.checklistTitle}
                    {session.checklistNumber && (
                      <span className="text-muted-foreground font-mono text-xs font-normal">({session.checklistNumber})</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {session.items.map((item) => {
                    const form = getChecklistForm(item.checklistItemId)
                    const submitting = !!checklistSubmitting[item.checklistItemId]
                    const error = checklistErrors[item.checklistItemId]
                    const latest = item.submissions[0]
                    const needsRevision = latest?.reviewStatus === "RevisionRequested"
                    return (
                      <div key={item.checklistItemId} className="space-y-2.5 rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {(item.section || item.reference) && (
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {item.section ?? ""}{item.section && item.reference ? " · " : ""}{item.reference ?? ""}
                              </p>
                            )}
                          </div>
                          {latest && reviewStatusBadge(latest.reviewStatus)}
                        </div>

                        {needsRevision && latest?.reviewNote && (
                          <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                            <span className="font-medium">Denetçi notu: </span>
                            {latest.reviewNote}
                          </p>
                        )}

                        {item.submissions.length > 0 && (
                          <ul className="space-y-1.5 border-t pt-2">
                            {item.submissions.map((sub) => (
                              <li key={sub.id} className="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">{formatDate(sub.submittedAt)}</span>
                                  {reviewStatusBadge(sub.reviewStatus)}
                                </div>
                                {sub.auditeeResponse && (
                                  <p className="mt-1">
                                    <span className="font-semibold">{sub.auditeeResponse}</span>
                                    <span className="text-muted-foreground"> ({RESULT_LABELS[sub.auditeeResponse as ResultKey] ?? sub.auditeeResponse})</span>
                                  </p>
                                )}
                                {sub.auditeeNote && <p className="mt-1 whitespace-pre-wrap">{sub.auditeeNote}</p>}
                                {sub.files.length > 0 && (
                                  <p className="mt-1 text-muted-foreground">
                                    {sub.files.map((f) => f.fileName).join(", ")}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Cevap</Label>
                            <div className="flex gap-1.5">
                              {RESULT_KEYS.map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => updateChecklistForm(item.checklistItemId, { result: form.result === r ? "" : r })}
                                  title={RESULT_LABELS[r]}
                                  className={cn(
                                    "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                                    form.result === r
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border text-muted-foreground hover:bg-muted/50",
                                    submitting && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Denetlenen Notu</Label>
                            <Textarea
                              value={form.note}
                              onChange={(e) => updateChecklistForm(item.checklistItemId, { note: e.target.value })}
                              placeholder="Notunuzu yazın (isteğe bağlı)…"
                              className="min-h-[70px] text-sm"
                              disabled={submitting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Dosya Eki</Label>
                            <input
                              type="file"
                              multiple
                              accept={FINDING_FILE_ACCEPT_HTML}
                              disabled={submitting}
                              className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs"
                              onChange={(e) =>
                                updateChecklistForm(item.checklistItemId, {
                                  files: [...form.files, ...Array.from(e.target.files ?? [])],
                                })
                              }
                            />
                            {form.files.length > 0 && (
                              <ul className="space-y-1">
                                {form.files.map((f, i) => (
                                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
                                    <span className="min-w-0 truncate">{f.name}</span>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() =>
                                        updateChecklistForm(item.checklistItemId, {
                                          files: form.files.filter((_, j) => j !== i),
                                        })
                                      }
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {error && <p className="text-xs text-destructive">{error}</p>}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              disabled={submitting}
                              onClick={() => void submitChecklistItem(item.checklistItemId)}
                            >
                              {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
                              {needsRevision ? "Yeniden Gönder" : "Gönder"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
