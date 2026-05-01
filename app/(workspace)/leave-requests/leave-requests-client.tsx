"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, parseISO, isWithinInterval } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Plus, CheckCircle2, XCircle, Clock, ChevronDown, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED"

interface LeaveRequest {
  id: number
  startDate: string
  endDate: string
  reason: string | null
  status: LeaveStatus
  reviewNote: string | null
  createdAt: string
  employee: {
    id: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    title: { titleName: string; isManager: boolean } | null
  }
  approver: { id: number; isim: string | null; soyisim: string | null } | null
}

interface AccessCtx {
  calisanId: number
  departman: string | null
  isManager: boolean
  isGlobalAdmin: boolean
}

interface PageData {
  requests: LeaveRequest[]
  titles: { id: number; titleName: string; departmentName: string; isManager: boolean }[]
  ctx: AccessCtx
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: LeaveStatus) {
  const map = {
    PENDING: { label: "Beklemede", icon: Clock, cls: "bg-amber-100 text-amber-800 border-amber-200" },
    APPROVED: { label: "Onaylandı", icon: CheckCircle2, cls: "bg-green-100 text-green-800 border-green-200" },
    REJECTED: { label: "Reddedildi", icon: XCircle, cls: "bg-red-100 text-red-800 border-red-200" },
  } as const
  const { label, icon: Icon, cls } = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      <Icon size={11} />
      {label}
    </span>
  )
}

function fullName(p: { isim: string | null; soyisim: string | null }) {
  return [p.isim, p.soyisim].filter(Boolean).join(" ") || "—"
}

function dateRange(start: string, end: string) {
  const s = parseISO(start)
  const e = parseISO(end)
  if (s.toDateString() === e.toDateString()) return format(s, "d MMM yyyy", { locale: tr })
  return `${format(s, "d MMM", { locale: tr })} – ${format(e, "d MMM yyyy", { locale: tr })}`
}

function isActiveToday(req: LeaveRequest): boolean {
  if (req.status !== "APPROVED") return false
  const today = new Date()
  return isWithinInterval(today, {
    start: parseISO(req.startDate),
    end: parseISO(req.endDate),
  })
}

// ─── New Request Dialog ───────────────────────────────────────────────────────

function NewRequestDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (req: LeaveRequest) => void
}) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error("Başlangıç ve bitiş tarihi zorunlu.")
      return
    }
    if (endDate < startDate) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ startDate, endDate, reason }),
      })
      const data = (await res.json()) as { leaveRequest?: LeaveRequest; error?: string }
      if (!res.ok) throw new Error(data.error || `Hata (${res.status})`)
      toast.success("İzin talebi oluşturuldu.")
      onCreated(data.leaveRequest!)
      onClose()
      setStartDate(""); setEndDate(""); setReason("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Talep oluşturulamadı.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni İzin Talebi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Başlangıç Tarihi</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Bitiş Tarihi</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Açıklama (opsiyonel)</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="İzin sebebinizi kısaca belirtin…" rows={3} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>İptal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Gönderiliyor…" : "Talep Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Review Dialog (Manager) ──────────────────────────────────────────────────

function ReviewDialog({
  leave,
  onClose,
  onReviewed,
}: {
  leave: LeaveRequest | null
  onClose: () => void
  onReviewed: (updated: LeaveRequest) => void
}) {
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const act = async (status: "APPROVED" | "REJECTED") => {
    if (!leave) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leave-requests/${leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status, reviewNote: note }),
      })
      const data = (await res.json()) as { leave?: LeaveRequest; error?: string }
      if (!res.ok) throw new Error(data.error || `Hata (${res.status})`)
      toast.success(status === "APPROVED" ? "İzin onaylandı." : "İzin reddedildi.")
      onReviewed(data.leave!)
      onClose()
      setNote("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!leave} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>İzin Talebini İncele</DialogTitle>
        </DialogHeader>
        {leave && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
              <p><span className="font-medium">Çalışan:</span> {fullName(leave.employee)}</p>
              <p><span className="font-medium">Departman:</span> {leave.employee.departman ?? "—"}</p>
              {leave.employee.title && <p><span className="font-medium">Unvan:</span> {leave.employee.title.titleName}</p>}
              <p><span className="font-medium">Tarih:</span> {dateRange(leave.startDate, leave.endDate)}</p>
              {leave.reason && <p><span className="font-medium">Sebep:</span> {leave.reason}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">İnceleme Notu (opsiyonel)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Onay / red gerekçesi…" rows={2} className="resize-none" />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Kapat</Button>
          <Button variant="destructive" onClick={() => act("REJECTED")} disabled={loading}>
            <XCircle size={14} className="mr-1" />Reddet
          </Button>
          <Button onClick={() => act("APPROVED")} disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 size={14} className="mr-1" />Onayla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaveRequestsClient({ data }: { data: PageData }) {
  const { ctx } = data
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [requests, setRequests] = useState<LeaveRequest[]>(data.requests)
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL")
  const [showNew, setShowNew] = useState(false)
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null)

  const filtered = statusFilter === "ALL"
    ? requests
    : requests.filter((r) => r.status === statusFilter)

  const handleCreated = (req: LeaveRequest) => {
    setRequests((prev) => [req, ...prev])
    startTransition(() => router.refresh())
  }

  const handleReviewed = (updated: LeaveRequest) => {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">İzin Talepleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ctx.isGlobalAdmin
              ? "Tüm departmanlar"
              : ctx.isManager
                ? `${ctx.departman} — yönetici görünümü`
                : "Kişisel izin talepleri"}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5">
          <Plus size={15} />
          Yeni Talep
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-3">
        <Filter size={13} className="text-muted-foreground mr-1" />
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}>
            {s === "ALL" ? "Tümü" : s === "PENDING" ? "Beklemede" : s === "APPROVED" ? "Onaylı" : "Reddedildi"}
            <span className="ml-1 opacity-60">
              ({s === "ALL" ? requests.length : requests.filter((r) => r.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
              {(ctx.isManager || ctx.isGlobalAdmin) && (
                <th className="px-4 py-3 font-medium">Çalışan</th>
              )}
              <th className="px-4 py-3 font-medium">Tarih Aralığı</th>
              <th className="px-4 py-3 font-medium">Sebep</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Onaylayıcı</th>
              {(ctx.isManager || ctx.isGlobalAdmin) && (
                <th className="px-4 py-3 font-medium">İşlem</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Bu filtrede izin talebi bulunamadı.
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const active = isActiveToday(req)
                return (
                  <tr key={req.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      active && "bg-red-50/60 dark:bg-red-900/10"
                    )}>
                    {(ctx.isManager || ctx.isGlobalAdmin) && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{fullName(req.employee)}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.employee.departman ?? "—"}
                          {req.employee.title && ` · ${req.employee.title.titleName}`}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dateRange(req.startDate, req.endDate)}
                      {active && (
                        <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1.5">
                          İzinli
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {req.reason ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {req.approver ? fullName(req.approver) : <span className="italic opacity-50">Atanmadı</span>}
                    </td>
                    {(ctx.isManager || ctx.isGlobalAdmin) && (
                      <td className="px-4 py-3">
                        {req.status === "PENDING" && req.employee.id !== ctx.calisanId ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            onClick={() => setReviewing(req)}>
                            <ChevronDown size={12} />
                            İncele
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {req.reviewNote ?? "—"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <NewRequestDialog open={showNew} onClose={() => setShowNew(false)} onCreated={handleCreated} />
      <ReviewDialog leave={reviewing} onClose={() => setReviewing(null)} onReviewed={handleReviewed} />
    </div>
  )
}
