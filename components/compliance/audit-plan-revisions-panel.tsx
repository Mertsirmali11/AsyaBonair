"use client"

import * as React from "react"
import { ChevronDown, Download, Paperclip, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { todayLocalDdMmYyyy } from "@/lib/correspondence-date"
import { uploadAuditPlanRevisionFilesDirect } from "@/lib/client-audit-plan-revision-upload"

type RevisionFile = {
  id: number
  fileName: string
  fileSizeBytes: number | null
  mimeType: string | null
}

type Revision = {
  id: number
  year: number
  revisionNumber: number
  revisionDate: string
  reason: string
  createdByName: string | null
  createdAt: string
  attachments: RevisionFile[]
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Yıllık Audit Plan'ın revizyon geçmişi — tek bir denetimin değil, PLANIN TAMAMININ değişiklik
 * kaydı (audit-log/changelog, snapshot DEĞİL). AuditPlanEntry/AuditSession/AuditFinding
 * ilişkilerine hiç dokunmaz — bkz. app/api/audit-plan-revisions/route.ts.
 * Yalnızca auditType="PLANNED" ekranında (audit-plan-client.tsx) kullanılır.
 */
export function AuditPlanRevisionsPanel({
  open,
  onOpenChange,
  defaultYear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultYear: number
}) {
  const uid = React.useId()
  const [year, setYear] = React.useState(defaultYear)
  const [revisions, setRevisions] = React.useState<Revision[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<number | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [revisionDate, setRevisionDate] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const yearOptions = React.useMemo(() => {
    const now = new Date().getUTCFullYear()
    const opts = new Set<number>([defaultYear, now])
    for (let y = now - 3; y <= now + 1; y++) opts.add(y)
    return [...opts].sort((a, b) => b - a)
  }, [defaultYear])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-plan-revisions?year=${year}`, { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Revizyon geçmişi yüklenemedi."
        )
        setRevisions([])
        return
      }
      setRevisions(Array.isArray(data) ? (data as Revision[]) : [])
    } catch {
      toast.error("Bağlantı hatası.")
      setRevisions([])
    } finally {
      setLoading(false)
    }
  }, [year])

  React.useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  React.useEffect(() => {
    if (open) setYear(defaultYear)
  }, [open, defaultYear])

  const openCreate = () => {
    setRevisionDate(todayLocalDdMmYyyy())
    setReason("")
    setPendingFiles([])
    setCreateOpen(true)
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error("Değişiklik açıklaması (Reason) zorunludur.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/audit-plan-revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, revisionDate, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Revizyon oluşturulamadı.")
        return
      }
      const created = data as Revision
      if (pendingFiles.length > 0) {
        try {
          const uploaded = await uploadAuditPlanRevisionFilesDirect(created.id, pendingFiles)
          if (uploaded.length > 0) {
            await fetch(`/api/audit-plan-revisions/${created.id}/files`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files: uploaded.map((u) => ({
                  path: u.path,
                  fileName: u.fileName,
                  mimeType: u.mimeType,
                  sizeBytes: u.sizeBytes,
                })),
              }),
            })
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Dosyalar yüklenemedi.")
          // Revizyon kaydı yine de oluşturuldu — dosya hatası akışı bloklamaz.
        }
      }
      toast.success(`Rev ${created.revisionNumber} oluşturuldu.`)
      setCreateOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(88vh,720px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pr-14 text-left">
            <DialogTitle>Auditing Revision Records</DialogTitle>
            <p className="text-muted-foreground text-sm">
              {year} Audit Plan için değişiklik geçmişi — yeni bir denetim eklendiğinde, tarih
              değiştiğinde, kapsam güncellendiğinde vb. yeni bir revizyon kaydedin.
            </p>
          </DialogHeader>

          <div className="flex shrink-0 items-center justify-between gap-2 px-6 py-3">
            <div className="flex items-center gap-2">
              <Label htmlFor={`rev-year-${uid}`} className="text-muted-foreground text-xs">
                Yıl
              </Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger id={`rev-year-${uid}`} className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-4" />
              New Revision
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 pb-6">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Yükleniyor…</p>
            ) : revisions.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {year} için henüz revizyon kaydı yok.
              </p>
            ) : (
              revisions.map((r) => (
                <Collapsible
                  key={r.id}
                  open={expandedId === r.id}
                  onOpenChange={(o) => setExpandedId(o ? r.id : null)}
                  className="bg-card overflow-hidden rounded-lg border"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="hover:bg-muted/40 flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium">
                        Rev {r.revisionNumber} · {r.revisionDate}
                        {r.attachments.length > 0 && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {r.attachments.length} attached file
                            {r.attachments.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={cn(
                          "text-muted-foreground size-4 shrink-0 transition-transform",
                          expandedId === r.id && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t px-4 py-3">
                    <p className="text-foreground text-sm whitespace-pre-wrap">{r.reason}</p>
                    {r.attachments.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {r.attachments.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 text-sm">
                            <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                            <a
                              href={`/api/audit-plan-revisions/${r.id}/files/${a.id}/file`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex min-w-0 items-center gap-1 truncate underline-offset-2 hover:underline"
                            >
                              <Download className="size-3.5 shrink-0" />
                              <span className="truncate">{a.fileName}</span>
                            </a>
                            {a.fileSizeBytes ? (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {formatBytes(a.fileSizeBytes)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-muted-foreground mt-3 text-xs">
                      {r.createdByName ?? "Bilinmeyen kullanıcı"} tarafından oluşturuldu
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New revision — {year} Audit Plan</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Revision Date</Label>
              <DatePicker value={revisionDate} onChange={setRevisionDate} placeholder="dd.mm.yyyy" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`rev-reason-${uid}`}>Changes / Revision Reason</Label>
              <Textarea
                id={`rev-reason-${uid}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[100px]"
                placeholder="e.g. CAMO Department audit date changed from 15.06.2026 to 30.06.2026."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`rev-files-${uid}`}>Attached Files (optional)</Label>
              <input
                id={`rev-files-${uid}`}
                type="file"
                multiple
                accept="application/pdf,.pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="border-input file:bg-background hover:file:bg-accent block w-full rounded-md border text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:text-sm file:font-medium"
                onChange={(e) => setPendingFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
              {pendingFiles.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} selected.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Create Revision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
