"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, parseISO, isWithinInterval } from "date-fns"
import { tr as trLocale } from "date-fns/locale"
import { useLanguage } from "@/lib/i18n/context"
import {
  Plus, CheckCircle2, XCircle, Clock, ChevronDown, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  LEAVE_SUBCATEGORY_LABELS,
  LEAVE_SUBCATEGORY_VALUES,
  leaveSubcategoryLabel,
  type LeaveSubcategory,
} from "@/lib/leave-subcategory"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED"

interface LeaveRequest {
  id: number
  startDate: string
  endDate: string
  subcategory: LeaveSubcategory | null
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

// statusBadge is defined inside LeaveRequestsClient to access translations

function fullName(p: { isim: string | null; soyisim: string | null }) {
  return [p.isim, p.soyisim].filter(Boolean).join(" ") || "—"
}

function dateRange(start: string, end: string, locale: string) {
  const s = parseISO(start)
  const e = parseISO(end)
  const dateFnsLocale = locale === "tr" ? trLocale : undefined
  if (s.toDateString() === e.toDateString()) return format(s, "d MMM yyyy", { locale: dateFnsLocale })
  return `${format(s, "d MMM", { locale: dateFnsLocale })} – ${format(e, "d MMM yyyy", { locale: dateFnsLocale })}`
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
  const { t } = useLanguage()
  const lr = t.leaveRequests
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [subcategory, setSubcategory] = useState<LeaveSubcategory | "">("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setStartDate("")
      setEndDate("")
      setSubcategory("")
      setReason("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error(lr.errors.startEndRequired)
      return
    }
    if (!subcategory) {
      toast.error(lr.errors.selectSubcategory)
      return
    }
    if (endDate < startDate) {
      toast.error(lr.errors.endBeforeStart)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ startDate, endDate, subcategory, reason }),
      })
      const data = (await res.json()) as { leaveRequest?: LeaveRequest; error?: string }
      if (!res.ok) throw new Error(data.error || `Hata (${res.status})`)
      toast.success(lr.createSuccess)
      onCreated(data.leaveRequest!)
      onClose()
      setStartDate(""); setEndDate(""); setSubcategory(""); setReason("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : lr.errors.createFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lr.newRequest}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{lr.startDate}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{lr.endDate}</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{lr.subcategory}</label>
            <Select
              value={subcategory || undefined}
              onValueChange={(v) => setSubcategory(v as LeaveSubcategory)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={lr.selectSubcategory} />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_SUBCATEGORY_VALUES.map((val) => (
                  <SelectItem key={val} value={val}>
                    {LEAVE_SUBCATEGORY_LABELS[val]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{lr.description}</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={lr.descriptionPlaceholder} rows={3} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{t.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? lr.sending : lr.createRequest}
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
  const { t, locale } = useLanguage()
  const lr = t.leaveRequests
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
      toast.success(status === "APPROVED" ? lr.approveSuccess : lr.rejectSuccess)
      onReviewed(data.leave!)
      onClose()
      setNote("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : lr.errors.actionFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!leave} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lr.reviewDialog}</DialogTitle>
        </DialogHeader>
        {leave && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
              <p><span className="font-medium">{lr.employee}:</span> {fullName(leave.employee)}</p>
              <p><span className="font-medium">Departman:</span> {leave.employee.departman ?? "—"}</p>
              {leave.employee.title && <p><span className="font-medium">Unvan:</span> {leave.employee.title.titleName}</p>}
              <p><span className="font-medium">{lr.dateRange}:</span> {dateRange(leave.startDate, leave.endDate, locale)}</p>
              <p>
                <span className="font-medium">{lr.subcategory}:</span>{" "}
                {leaveSubcategoryLabel(leave.subcategory)}
              </p>
              {leave.reason && <p><span className="font-medium">{lr.reason}:</span> {leave.reason}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{lr.reviewNote}</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={lr.reviewNotePlaceholder} rows={2} className="resize-none" />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>{t.common.close}</Button>
          <Button variant="destructive" onClick={() => act("REJECTED")} disabled={loading}>
            <XCircle size={14} className="mr-1" />{t.common.reject}
          </Button>
          <Button onClick={() => act("APPROVED")} disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 size={14} className="mr-1" />{t.common.approve}
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
  const { t, locale } = useLanguage()
  const lr = t.leaveRequests
  const [, startTransition] = useTransition()

  const statusBadge = (status: LeaveStatus) => {
    const map = {
      PENDING: { label: lr.pending, icon: Clock, cls: "bg-amber-100 text-amber-800 border-amber-200" },
      APPROVED: { label: lr.approved, icon: CheckCircle2, cls: "bg-green-100 text-green-800 border-green-200" },
      REJECTED: { label: lr.rejected, icon: XCircle, cls: "bg-red-100 text-red-800 border-red-200" },
    } as const
    const { label, icon: Icon, cls } = map[status]
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
        <Icon size={11} />
        {label}
      </span>
    )
  }
  const [requests, setRequests] = useState<LeaveRequest[]>(data.requests)
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL")
  const [scope, setScope] = useState<"DEPARTMENT" | "MINE">(
    ctx.isManager || ctx.isGlobalAdmin ? "DEPARTMENT" : "MINE"
  )
  const [showNew, setShowNew] = useState(false)
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null)

  const scopedRequests =
    ctx.isManager || ctx.isGlobalAdmin
      ? scope === "MINE"
        ? requests.filter((r) => r.employee.id === ctx.calisanId)
        : requests
      : requests

  const filtered =
    statusFilter === "ALL"
      ? scopedRequests
      : scopedRequests.filter((r) => r.status === statusFilter)

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
          <h1 className="text-xl font-bold">{lr.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ctx.isGlobalAdmin
              ? lr.allDepartments
              : ctx.isManager
                ? `${ctx.departman} — ${lr.managerView}`
                : lr.personalLeave}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5">
          <Plus size={15} />
          {lr.newRequest}
        </Button>
      </div>

      {/* Manager scope tabs */}
      {(ctx.isManager || ctx.isGlobalAdmin) && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("DEPARTMENT")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              scope === "DEPARTMENT"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Departman Talepleri
          </button>
          <button
            type="button"
            onClick={() => setScope("MINE")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              scope === "MINE"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Benim Taleplerim
          </button>
        </div>
      )}

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
            {s === "ALL" ? t.common.all : s === "PENDING" ? lr.pending : s === "APPROVED" ? lr.approved : lr.rejected}
            <span className="ml-1 opacity-60">
              ({s === "ALL" ? scopedRequests.length : scopedRequests.filter((r) => r.status === s).length})
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
                <th className="px-4 py-3 font-medium">{lr.employee}</th>
              )}
              <th className="px-4 py-3 font-medium">{lr.dateRange}</th>
              <th className="px-4 py-3 font-medium">{lr.subcategory}</th>
              <th className="px-4 py-3 font-medium">{lr.reason}</th>
              <th className="px-4 py-3 font-medium">{lr.status}</th>
              <th className="px-4 py-3 font-medium">{lr.approver}</th>
              {(ctx.isManager || ctx.isGlobalAdmin) && (
                <th className="px-4 py-3 font-medium">{lr.action}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={(ctx.isManager || ctx.isGlobalAdmin) ? 7 : 5}
                  className="px-4 py-10 text-center text-muted-foreground text-sm"
                >
                  {lr.noRequests}
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
                      {dateRange(req.startDate, req.endDate, locale)}
                      {active && (
                        <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1.5">
                          {lr.activeToday}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm max-w-[180px]">
                      {leaveSubcategoryLabel(req.subcategory)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {req.reason ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {req.approver ? fullName(req.approver) : <span className="italic opacity-50">{lr.notAssigned}</span>}
                    </td>
                    {(ctx.isManager || ctx.isGlobalAdmin) && (
                      <td className="px-4 py-3">
                        {req.status === "PENDING" && req.employee.id !== ctx.calisanId ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            onClick={() => setReviewing(req)}>
                            <ChevronDown size={12} />
                            {lr.review}
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
