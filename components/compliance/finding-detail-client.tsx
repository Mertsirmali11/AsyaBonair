"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  Paperclip,
  Send,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Attachment = {
  id: number
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSizeBytes: number | null
  uploadedAt: string
}

type Response = {
  id: number
  rootCause: string | null
  correctiveAction: string | null
  preventiveAction: string | null
  cpaStatus: string
  submittedAt: string
  respondedBy: { id: number; isim: string | null; soyisim: string | null } | null
  attachments: Attachment[]
}

type Extension = {
  id: number
  newDueDate: string
  reason: string | null
  status: string
  isExpired: boolean
  requestedBy: { id: number; isim: string | null; soyisim: string | null } | null
  createdAt: string
}

type FindingDetail = {
  id: number
  findingCode: string
  explanation: string
  reference: string | null
  field: string | null
  auditNumber: string | null
  initializedOn: string
  dueDate: string | null
  status: string
  assignedTo: { id: number; isim: string | null; soyisim: string | null; departman: string | null } | null
  responses: Response[]
  extensions: Extension[]
  session: {
    entry: {
      auditCategoryType: { name: string }
      auditSubCategoryType: { name: string } | null
    }
    checklist: { id: number; title: string; checklistNumber: string | null }
  }
  sessionItem: {
    checklistItem: { label: string; reference: string | null }
  } | null
}

type CalisanLite = { id: number; isim: string | null; soyisim: string | null }

async function parseJson(res: Response | globalThis.Response): Promise<unknown> {
  const t = await (res as globalThis.Response).text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return "—" }
}

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "—"
  return [c.isim, c.soyisim].filter(Boolean).join(" ") || "—"
}

const cpaStatusConfig: Record<string, { label: string; cls: string }> = {
  Pending: { label: "Bekliyor", cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700" },
  Accepted: { label: "Kabul edildi", cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700" },
  Rejected: { label: "Reddedildi", cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700" },
}

export function FindingDetailClient({ findingId }: { findingId: number }) {
  const [finding, setFinding] = React.useState<FindingDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [calisanlar, setCalisanlar] = React.useState<CalisanLite[]>([])

  // Response form state
  const [responseOpen, setResponseOpen] = React.useState(false)
  const [rootCause, setRootCause] = React.useState("")
  const [correctiveAction, setCorrectiveAction] = React.useState("")
  const [preventiveAction, setPreventiveAction] = React.useState("")
  const [respondedById, setRespondedById] = React.useState<string>("")
  const [submitting, setSubmitting] = React.useState(false)

  // Attachment state
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const [createdResponseId, setCreatedResponseId] = React.useState<number | null>(null)

  // Assign user state
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignedToId, setAssignedToId] = React.useState<string>("")
  const [assigning, setAssigning] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, { cache: "no-store" })
      const data = await parseJson(res as globalThis.Response)
      if (!res.ok || !data) { toast.error("Bulgu yüklenemedi."); return }
      setFinding(data as FindingDetail)
    } catch {
      toast.error("Yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [findingId])

  const loadCalisanlar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/calisanlar?limit=200", { cache: "no-store" })
      const data = await parseJson(res as globalThis.Response)
      if (Array.isArray(data)) setCalisanlar(data as CalisanLite[])
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => { void load(); void loadCalisanlar() }, [load, loadCalisanlar])

  const submitResponse = async () => {
    if (!rootCause.trim() && !correctiveAction.trim() && !preventiveAction.trim()) {
      toast.error("En az bir alan doldurulmalı.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootCause: rootCause.trim() || null,
          correctiveAction: correctiveAction.trim() || null,
          preventiveAction: preventiveAction.trim() || null,
          respondedById: respondedById ? Number(respondedById) : null,
        }),
      })
      const data = (await parseJson(res as globalThis.Response)) as { id?: unknown; error?: string } | null
      if (!res.ok) {
        const msg = data && typeof data.error === "string" && data.error.trim() ? data.error.trim() : "Gönderilemedi."
        toast.error(msg)
        return
      }
      const createdId = data && typeof data.id === "number" ? data.id : NaN
      if (!Number.isFinite(createdId)) {
        toast.error("Sunucu yanıtı geçersiz. Sayfayı yenileyip tekrar deneyin.")
        return
      }
      setCreatedResponseId(createdId)

      // Upload pending files
      if (pendingFiles.length > 0) {
        setUploadingFiles(true)
        let uploadErr = false
        for (const file of pendingFiles) {
          const form = new FormData()
          form.append("file", file)
          form.append("responseId", String(createdId))
          const up = await fetch(`/api/audit-findings/${findingId}/attachments`, {
            method: "POST",
            body: form,
          })
          if (!up.ok) uploadErr = true
        }
        setUploadingFiles(false)
        setPendingFiles([])
        if (uploadErr) toast.error("Cevap kaydedildi ancak bazı ekler yüklenemedi.")
      }

      toast.success("Cevap gönderildi.")
      setResponseOpen(false)
      setRootCause("")
      setCorrectiveAction("")
      setPreventiveAction("")
      setRespondedById("")
      setCreatedResponseId(null)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSubmitting(false)
    }
  }

  const openResponseDialog = () => {
    setRootCause("")
    setCorrectiveAction("")
    setPreventiveAction("")
    setPendingFiles([])
    setRespondedById(finding?.assignedTo ? String(finding.assignedTo.id) : "")
    setResponseOpen(true)
  }

  const updateCpaStatus = async (responseId: number, cpaStatus: string) => {
    try {
      const res = await fetch(`/api/audit-findings/${findingId}/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpaStatus }),
      })
      if (!res.ok) { toast.error("Güncellenemedi."); return }
      toast.success(`CPA durumu: ${cpaStatus === "Accepted" ? "Kabul edildi" : "Reddedildi"}`)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }

  const assignFinding = async () => {
    setAssigning(true)
    try {
      const res = await fetch(`/api/audit-findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId ? Number(assignedToId) : null }),
      })
      if (!res.ok) { toast.error("Atanamadı."); return }
      toast.success("Atama güncellendi.")
      setAssignOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!finding) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">Bulgu bulunamadı.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/compliance/findings-follow-up">Geri dön</Link>
        </Button>
      </div>
    )
  }

  const isOpen = finding.status === "Open"

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={finding.findingCode} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/findings-follow-up">Findings Follow Up</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{finding.findingCode}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link href="/compliance/findings-follow-up"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{finding.findingCode}</h1>
              <p className="text-muted-foreground text-sm">{finding.auditNumber ?? "—"} · {finding.field ?? "—"}</p>
            </div>
            <Badge className={cn(
              "ml-1",
              isOpen ? "bg-blue-600 text-white" : "bg-teal-600 text-white"
            )}>
              {isOpen ? "Açık" : "Kapalı"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setAssignedToId(finding.assignedTo ? String(finding.assignedTo.id) : "")
              setAssignOpen(true)
            }}>
              <User className="mr-1.5 size-3.5" />
              {finding.assignedTo ? calisanName(finding.assignedTo) : "Atama yap"}
            </Button>
            {isOpen && (
              <Button
                type="button"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={openResponseDialog}
              >
                <Send className="mr-1.5 size-3.5" />
                Cevap Ver
              </Button>
            )}
          </div>
        </div>

        {/* Finding details card */}
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Bulgu Kodu</p>
              <p className="font-mono text-sm font-semibold">{finding.findingCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Denetim Numarası</p>
              <p className="text-sm">{finding.auditNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Alan</p>
              <p className="text-sm">{finding.field ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Başlangıç Tarihi</p>
              <p className="text-sm">{formatDate(finding.initializedOn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Vade Tarihi</p>
              <p className={cn("text-sm", isOpen && finding.dueDate && new Date(finding.dueDate) < new Date() ? "text-red-600 font-semibold" : "")}>
                {formatDate(finding.dueDate)}
                {isOpen && finding.dueDate && new Date(finding.dueDate) < new Date() && (
                  <AlertTriangle className="inline ml-1 size-3.5" />
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Atanan Kişi</p>
              <p className="text-sm">
                {finding.assignedTo ? (
                  <>
                    {calisanName(finding.assignedTo)}
                    {finding.assignedTo.departman && (
                      <span className="text-muted-foreground ml-1">({finding.assignedTo.departman})</span>
                    )}
                  </>
                ) : "—"}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-muted-foreground text-xs font-medium">Açıklama / Bulgu</p>
              <p className="text-sm leading-relaxed mt-0.5">{finding.explanation}</p>
            </div>
            {finding.reference && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">Referans</p>
                <p className="font-mono text-sm">{finding.reference}</p>
              </div>
            )}
            {finding.sessionItem && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium">Checklist Maddesi</p>
                <p className="text-sm">{finding.sessionItem.checklistItem.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Responses */}
        <div>
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <GitBranch className="size-4 text-blue-600" />
            Kök Neden Analizi & CPA Cevapları ({finding.responses.length})
          </h2>

          {finding.responses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Henüz cevap verilmemiş.
              {isOpen && (
                <p className="mt-1">
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={openResponseDialog}>
                    İlk cevabı gönder →
                  </Button>
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {finding.responses.map((resp, idx) => {
                const cfg = cpaStatusConfig[resp.cpaStatus] ?? cpaStatusConfig.Pending
                return (
                  <div key={resp.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
                    {/* Response header */}
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Cevap #{idx + 1}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{formatDate(resp.submittedAt)}</span>
                        {resp.respondedBy && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{calisanName(resp.respondedBy)}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-xs", cfg.cls)}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="p-4 space-y-3">
                      {resp.rootCause && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Kök Neden (Root Cause)</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.rootCause}</p>
                        </div>
                      )}
                      {resp.correctiveAction && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Düzeltici Faaliyet</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.correctiveAction}</p>
                        </div>
                      )}
                      {resp.preventiveAction && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Önleyici Faaliyet</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.preventiveAction}</p>
                        </div>
                      )}

                      {/* Attachments */}
                      {resp.attachments.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ekler</p>
                          <div className="flex flex-wrap gap-1.5">
                            {resp.attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                                <Paperclip className="size-3 shrink-0" />
                                <span className="max-w-[160px] truncate">{att.fileName}</span>
                                {att.fileSizeBytes && (
                                  <span className="text-muted-foreground">
                                    ({Math.ceil(att.fileSizeBytes / 1024)} KB)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CPA Actions */}
                      {isOpen && resp.cpaStatus === "Pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                            onClick={() => void updateCpaStatus(resp.id, "Accepted")}
                          >
                            <CheckCircle2 className="mr-1.5 size-3.5" />
                            CPA Kabul Et
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 dark:text-red-400"
                            onClick={() => void updateCpaStatus(resp.id, "Rejected")}
                          >
                            <XCircle className="mr-1.5 size-3.5" />
                            CPA Reddet
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Response dialog */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="flex w-[calc(100vw-1.5rem)] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-6 pt-6 pr-14 text-left">
            <DialogTitle>Bulguya Cevap Ver — Kök Neden Analizi</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{finding.findingCode}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{finding.explanation}</p>
              </div>

              <div className="space-y-2">
                <Label>Cevaplayan Kişi</Label>
                <Select
                  value={respondedById ? respondedById : undefined}
                  onValueChange={setRespondedById}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kişi seç…" />
                  </SelectTrigger>
                  <SelectContent>
                    {calisanlar.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {calisanName(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kök Neden (Root Cause) *</Label>
                <p className="text-muted-foreground text-xs">
                  5-Why veya Ishikawa yöntemi ile kök nedeni açıklayın.
                </p>
                <Textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Neden oluştu? Kök neden nedir?"
                  className="min-h-[90px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Düzeltici Faaliyet (Corrective Action)</Label>
                <Textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Mevcut uygunsuzluğu gidermek için yapılacaklar…"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Önleyici Faaliyet (Preventive Action)</Label>
                <Textarea
                  value={preventiveAction}
                  onChange={(e) => setPreventiveAction(e.target.value)}
                  placeholder="Tekrarlanmasını önlemek için alınacak önlemler…"
                  className="min-h-[80px]"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label>Ekler (İsteğe Bağlı)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="mr-1.5 size-3.5" />
                    Dosya Ekle
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setPendingFiles((prev) => [...prev, ...files])
                      e.target.value = ""
                    }}
                  />
                </div>
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 rounded border bg-muted/40 px-2 py-1 text-xs">
                        <FileText className="size-3 shrink-0" />
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0 border-t px-6 py-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setResponseOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={submitting || uploadingFiles}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => void submitResponse()}
            >
              {submitting || uploadingFiles ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />{uploadingFiles ? "Dosyalar yükleniyor…" : "Gönderiliyor…"}</>
              ) : (
                <><Send className="mr-1.5 size-4" />Gönder</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulgyu Ata</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Sorumlu Kişi</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Kişi seç…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">— Atamasız</SelectItem>
                {calisanlar.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {calisanName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Vazgeç</Button>
            <Button type="button" disabled={assigning} onClick={assignFinding}>
              {assigning ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
