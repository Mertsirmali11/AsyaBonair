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
  auditeeResponse: string | null
  auditeeNote: string | null
  reviewStatus: string
  reviewNote: string | null
  submittedAt: string
  files: { id: number; fileName: string; fileSizeBytes: number | null }[]
}
type ChecklistItemRow = {
  sessionItemId: number
  label: string
  reference: string | null
  section: string | null
  submissions: ChecklistSubmissionRow[]
}
type ChecklistSessionRow = {
  sessionId: number
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

  // Checklist — soru başına cevap/not/dosya formu (sessionItemId -> form state)
  type ChecklistFormState = { response: string; note: string; files: File[] }
  const [checklistForms, setChecklistForms] = React.useState<Record<number, ChecklistFormState>>({})
  const [checklistSubmitting, setChecklistSubmitting] = React.useState<Record<number, boolean>>({})
  const [checklistErrors, setChecklistErrors] = React.useState<Record<number, string>>({})

  const getChecklistForm = (sessionItemId: number): ChecklistFormState =>
    checklistForms[sessionItemId] ?? { response: "", note: "", files: [] }

  const updateChecklistForm = (sessionItemId: number, patch: Partial<ChecklistFormState>) => {
    setChecklistForms((prev) => ({ ...prev, [sessionItemId]: { ...getChecklistForm(sessionItemId), ...patch } }))
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

  const submitChecklistItem = async (sessionItemId: number) => {
    setChecklistErrors((prev) => ({ ...prev, [sessionItemId]: "" }))
    if (!nameOk) {
      setChecklistErrors((prev) => ({ ...prev, [sessionItemId]: "İsim zorunludur (yukarıdaki 'Your Details' bölümü)." }))
      return
    }
    const form = getChecklistForm(sessionItemId)
    if (!form.response.trim() && !form.note.trim() && form.files.length === 0) {
      setChecklistErrors((prev) => ({ ...prev, [sessionItemId]: "Cevap, not veya dosyalardan en az biri girilmelidir." }))
      return
    }
    setChecklistSubmitting((prev) => ({ ...prev, [sessionItemId]: true }))
    try {
      const uploaded =
        form.files.length > 0
          ? await uploadAuditResponseChecklistFilesDirect(token, sessionItemId, form.files)
          : []
      const res = await fetch(`/api/audit-response/${token}/checklist/${sessionItemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditeeResponse: form.response.trim() || undefined,
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
      updateChecklistForm(sessionItemId, { response: "", note: "", files: [] })
      if (state.status === "ready") {
        setState({
          ...state,
          checklistSessions: state.checklistSessions.map((s) => ({
            ...s,
            items: s.items.map((it) =>
              it.sessionItemId === sessionItemId
                ? { ...it, submissions: [data.submission!, ...it.submissions] }
                : it
            ),
          })),
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gönderilemedi. Lütfen tekrar deneyin."
      setChecklistErrors((prev) => ({ ...prev, [sessionItemId]: message }))
      toast.error(message)
    } finally {
      setChecklistSubmitting((prev) => ({ ...prev, [sessionItemId]: false }))
    }
  }

  const reviewStatusBadge = (status: string) => {
    if (status === "Accepted") {
      return (
        <Badge className="gap-1 bg-teal-600 text-white hover:bg-teal-600">
          <CheckCircle2 className="size-3" /> Accepted
        </Badge>
      )
    }
    if (status === "Rejected") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3" /> Revision Requested
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="size-3" /> Pending Review
      </Badge>
    )
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

            {state.checklistSessions.map((session) => (
              <Card key={session.sessionId} className="shadow-sm">
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
                    const form = getChecklistForm(item.sessionItemId)
                    const submitting = !!checklistSubmitting[item.sessionItemId]
                    const error = checklistErrors[item.sessionItemId]
                    const latest = item.submissions[0]
                    return (
                      <div key={item.sessionItemId} className="space-y-2.5 rounded-lg border p-3">
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

                        {latest && latest.reviewStatus === "Rejected" && latest.reviewNote && (
                          <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
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
                                {sub.auditeeResponse && <p className="mt-1 whitespace-pre-wrap">{sub.auditeeResponse}</p>}
                                {sub.auditeeNote && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{sub.auditeeNote}</p>}
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
                          <div className="space-y-1">
                            <Label className="text-xs">Auditee Response</Label>
                            <Textarea
                              value={form.response}
                              onChange={(e) => updateChecklistForm(item.sessionItemId, { response: e.target.value })}
                              placeholder="Cevabınızı yazın…"
                              className="min-h-[70px] text-sm"
                              disabled={submitting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Auditee Note</Label>
                            <Textarea
                              value={form.note}
                              onChange={(e) => updateChecklistForm(item.sessionItemId, { note: e.target.value })}
                              placeholder="Ek not (isteğe bağlı)…"
                              className="min-h-[50px] text-sm"
                              disabled={submitting}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Attachment</Label>
                            <input
                              type="file"
                              multiple
                              accept={FINDING_FILE_ACCEPT_HTML}
                              disabled={submitting}
                              className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs"
                              onChange={(e) =>
                                updateChecklistForm(item.sessionItemId, {
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
                                        updateChecklistForm(item.sessionItemId, {
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
                              onClick={() => void submitChecklistItem(item.sessionItemId)}
                            >
                              {submitting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
                              Submit
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
