"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { ShgmCategoryKey } from "@/lib/shgm/categories"

export type ShgmRegulationDetail = {
  id: number
  title: string
  category: string
  department: string | null
  status: string
  sourceUrl: string
  publishDate: string | null
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
}: {
  detail: ShgmRegulationDetail
  categoryLabels: Record<ShgmCategoryKey, string>
}) {
  const [department, setDepartment] = React.useState(detail.department ?? "")
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState(detail.status)

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
      <Link
        href="/compliance/shgm-mevzuat"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline w-fit"
      >
        <ArrowLeft className="size-4" />
        SHGM Mevzuat listesine dön
      </Link>

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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sorumlu Departman</label>
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="ör. Kalite"
            className="w-56"
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
