"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Check,
  ChevronsUpDown,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ShgmCategoryKey } from "@/lib/shgm/categories"

/** Sorumlu Departman için searchable dropdown — seçenekler customDepartment kayıtlarından (bkz. [id]/page.tsx). Tek seçim; şema tek alan destekliyor. */
function DepartmentCombobox({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr")
    if (!q) return options
    return options.filter((o) => o.toLocaleLowerCase("tr").includes(q))
  }, [options, query])

  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          className={cn(
            "h-9 w-56 justify-between px-3 font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || "Departman seçin…"}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="flex flex-col">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Departman ara…"
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            <div className="flex flex-col p-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  Sonuç yok.
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={cn(
                      "hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      value === opt && "bg-muted"
                    )}
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn("size-4 shrink-0", value === opt ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{opt}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export type ShgmRegulationDetail = {
  id: number
  title: string
  category: string
  department: string | null
  status: string
  sourceUrl: string
  publishDate: string | null
  aiSummary: string | null
  aiSummaryUpdatedAt: string | null
  revisions: {
    id: number
    kind: string
    revisionNo: string | null
    revisionDate: string | null
    detectedAt: string
    hasPdf: boolean
    sourceUrl: string
    emailSentAt: string | null
  }[]
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("tr-TR")
  } catch {
    return "—"
  }
}

export function ShgmMevzuatDetailClient({
  detail,
  categoryLabels,
  departmentOptions,
}: {
  detail: ShgmRegulationDetail
  categoryLabels: Record<ShgmCategoryKey, string>
  departmentOptions: string[]
}) {
  const [department, setDepartment] = React.useState(detail.department ?? "")
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState(detail.status)
  const [aiSummary, setAiSummary] = React.useState(detail.aiSummary)
  const [aiSummaryUpdatedAt, setAiSummaryUpdatedAt] = React.useState(detail.aiSummaryUpdatedAt)
  const [summarizing, setSummarizing] = React.useState(false)
  const [sendingTestEmail, setSendingTestEmail] = React.useState(false)

  async function sendTestEmail() {
    setSendingTestEmail(true)
    try {
      const res = await fetch("/api/shgm-mevzuat/test-notification", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Test e-postası gönderilemedi.")
      toast.success("Test e-postası gönderildi.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test e-postası gönderilemedi.")
    } finally {
      setSendingTestEmail(false)
    }
  }

  async function regenerateSummary() {
    setSummarizing(true)
    try {
      const res = await fetch(`/api/shgm-mevzuat/${detail.id}/summarize`, { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as {
        aiSummary?: string
        aiSummaryUpdatedAt?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Özet oluşturulamadı.")
      setAiSummary(data.aiSummary ?? null)
      setAiSummaryUpdatedAt(data.aiSummaryUpdatedAt ?? null)
      toast.success("Özet oluşturuldu.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Özet oluşturulamadı.")
    } finally {
      setSummarizing(false)
    }
  }

  async function saveDepartment() {
    setSaving(true)
    try {
      const res = await fetch(`/api/shgm-mevzuat/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department }),
      })
      if (!res.ok) throw new Error()
      toast.success("Departman güncellendi.")
    } catch {
      toast.error("Güncellenemedi.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus() {
    const next = status === "new" ? "reviewed" : "new"
    const res = await fetch(`/api/shgm-mevzuat/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) {
      toast.error("Güncellenemedi.")
      return
    }
    setStatus(next)
    toast.success(next === "reviewed" ? "İncelendi olarak işaretlendi." : "Yeni olarak işaretlendi.")
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/compliance/shgm-mevzuat"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline w-fit"
        >
          <ArrowLeft className="size-4" />
          SHGM Mevzuat listesine dön
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={sendTestEmail}
          disabled={sendingTestEmail}
          className="gap-1.5"
          title="Gerçek mevzuat verisi kullanmaz; scanner/notification durumunu değiştirmez."
        >
          <Send className={`size-3.5 ${sendingTestEmail ? "animate-pulse" : ""}`} />
          {sendingTestEmail ? "Gönderiliyor…" : "Test Bildirim E-postası Gönder"}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {categoryLabels[detail.category as ShgmCategoryKey] ?? detail.category}
          </Badge>
          <Badge variant={status === "new" ? "default" : "outline"}>
            {status === "new" ? "Yeni" : "İncelendi"}
          </Badge>
        </div>
        <h1 className="text-xl font-semibold">{detail.title}</h1>
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline w-fit"
        >
          SHGM kaynağı <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="rounded-lg border p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            AI Özet
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={regenerateSummary}
            disabled={summarizing}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${summarizing ? "animate-spin" : ""}`} />
            {summarizing ? "Oluşturuluyor…" : aiSummary ? "Yeniden oluştur" : "Özet oluştur"}
          </Button>
        </div>
        {aiSummary ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{aiSummary}</p>
            {aiSummaryUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Son güncelleme: {formatDate(aiSummaryUpdatedAt)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Henüz özet oluşturulmadı. Yukarıdaki butonla oluşturabilirsiniz.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sorumlu Departman</label>
          <DepartmentCombobox
            options={departmentOptions}
            value={department}
            onChange={setDepartment}
          />
        </div>
        <Button size="sm" onClick={saveDepartment} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button size="sm" variant="outline" onClick={toggleStatus}>
          {status === "new" ? "İncelendi olarak işaretle" : "Yeni olarak işaretle"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Revizyon Geçmişi</h2>
        <ol className="flex flex-col gap-3">
          {detail.revisions.map((rev) => (
            <li key={rev.id} className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant={rev.kind === "created" ? "default" : "secondary"}>
                  {rev.kind === "created" ? "Yeni Yayım" : "Revizyon"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {rev.revisionNo ? `No: ${rev.revisionNo}` : ""}
                  {rev.revisionDate ? ` · Tarih: ${formatDate(rev.revisionDate)}` : ""}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Tespit: {formatDate(rev.detectedAt)}
                {rev.emailSentAt ? " · Bildirim e-postası gönderildi" : ""}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {rev.hasPdf ? (
                  <a
                    href={`/api/shgm-mevzuat/revisions/${rev.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <FileText className="size-4" />
                    PDF görüntüle
                  </a>
                ) : null}
                <a
                  href={rev.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                >
                  SHGM sayfası <ExternalLink className="size-3" />
                </a>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
