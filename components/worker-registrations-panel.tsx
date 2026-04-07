"use client"

import * as React from "react"
import { IconEye, IconRefresh, IconX } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  PILOT_RANKS,
  WORKER_REGISTRATION_DEPARTMENTS,
} from "@/lib/worker-registration-constants"

export type WorkerRegistrationRow = {
  id: number
  status: "PENDING" | "APPROVED" | "REJECTED"
  isim: string | null
  soyisim: string | null
  departman: string | null
  tcNo: string | null
  dogumTarihi: string | null
  telNo: string | null
  adres: string | null
  anneAdi: string | null
  babaAdi: string | null
  medeniDurum: string | null
  cocuk: number
  kanGrubu: string | null
  email: string
  egitimDurum: string | null
  acilIletisim: string | null
  acilIletisimTel: string | null
  sgkSicilNo: string | null
  bankaAdi: string | null
  iban: string | null
  iseGirisTarihi: string | null
  istenCikisTarihi: string | null
  ekstra1: string | null
  ekstra2: string | null
  ekstra3: string | null
  profilFotoUrl: string | null
  reviewedAt: string | null
  reviewedByCalisanId: number | null
  rejectionReason: string | null
  approvedCalisanId: number | null
  createdAt: string
  updatedAt: string
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

function statusBadge(status: WorkerRegistrationRow["status"]) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="secondary" className="bg-amber-500/15 text-amber-900 dark:text-amber-100">
          Pending
        </Badge>
      )
    case "APPROVED":
      return (
        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100">
          Approved
        </Badge>
      )
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function WorkerRegistrationsPanel({ embedded = false }: { embedded?: boolean }) {
  const [statusFilter, setStatusFilter] = React.useState<string>("PENDING")
  const [rows, setRows] = React.useState<WorkerRegistrationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<WorkerRegistrationRow | null>(null)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [actionLoading, setActionLoading] = React.useState(false)
  const [assignDepartment, setAssignDepartment] = React.useState("")
  const [assignPilotRank, setAssignPilotRank] = React.useState("")

  React.useEffect(() => {
    if (detail?.status === "PENDING") {
      setAssignDepartment("")
      setAssignPilotRank("")
    }
  }, [detail?.id, detail?.status])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/worker-registrations?status=${encodeURIComponent(statusFilter)}`,
        { cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error || "Failed to load")
        setRows([])
        return
      }
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setError("Network error")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  async function approve(
    id: number,
    departman: string,
    pilotRank: string
  ) {
    if (!departman.trim()) {
      alert("Select a department before approving.")
      return
    }
    if (departman === "Pilot") {
      if (!PILOT_RANKS.includes(pilotRank as (typeof PILOT_RANKS)[number])) {
        alert("Select Captain or F/O for Pilot.")
        return
      }
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/worker-registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          departman: departman.trim(),
          ...(departman === "Pilot" ? { ekstra3: pilotRank } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error || "Approve failed")
        return
      }
      setDetail(null)
      void load()
    } finally {
      setActionLoading(false)
    }
  }

  async function reject(id: number) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/worker-registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error || "Reject failed")
        return
      }
      setRejectOpen(false)
      setRejectReason("")
      setDetail(null)
      void load()
    } finally {
      setActionLoading(false)
    }
  }

  const nameOf = (r: WorkerRegistrationRow) =>
    `${r.isim || ""} ${r.soyisim || ""}`.trim() || "—"

  return (
    <div className="space-y-6">
      <div
        className={
          embedded
            ? "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            : "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between"
        }
      >
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New worker registrations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review self-service sign-up requests. When you approve, assign a department; hire date
              is set automatically to the approval date (Istanbul). Login uses the email and
              password they registered with.
            </p>
          </div>
        )}
        {embedded && (
          <p className="text-muted-foreground min-w-0 max-w-3xl flex-1 text-left text-sm leading-relaxed">
            Approve or reject self-service sign-ups. Hire date is set to the approval date (Istanbul).
            Login uses the email and password they registered with.
          </p>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Label htmlFor="reg-status" className="sr-only">
            Status filter
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="reg-status" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void load()}>
            <IconRefresh className="size-4" />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No registrations in this view.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Avatar className="size-9">
                      <AvatarImage src={r.profilFotoUrl ?? undefined} className="object-cover" />
                      <AvatarFallback className="text-xs">
                        {nameOf(r)
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{nameOf(r)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.departman?.trim()
                      ? r.departman
                      : r.status === "PENDING"
                        ? "To assign"
                        : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => setDetail(r)}
                    >
                      <IconEye className="size-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{nameOf(detail)}</DialogTitle>
                <DialogDescription>
                  Registration #{detail.id} · {detail.email}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="size-28 ring-2 ring-border">
                    <AvatarImage src={detail.profilFotoUrl ?? undefined} className="object-cover" />
                    <AvatarFallback className="text-xl">{nameOf(detail).slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  {statusBadge(detail.status)}
                </div>
                <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {detail.status !== "PENDING" && (
                    <>
                      <DetailItem label="Department" value={detail.departman} />
                      <DetailItem label="Pilot / rank" value={detail.ekstra3} />
                    </>
                  )}
                  <DetailItem label="ID number" value={detail.tcNo} />
                  <DetailItem label="Date of birth" value={formatDate(detail.dogumTarihi)} />
                  <DetailItem label="Phone" value={detail.telNo} />
                  <DetailItem label="Address" value={detail.adres} />
                  <DetailItem label="Mother" value={detail.anneAdi} />
                  <DetailItem label="Father" value={detail.babaAdi} />
                  <DetailItem label="Marital status" value={detail.medeniDurum} />
                  <DetailItem label="Children" value={String(detail.cocuk)} />
                  <DetailItem label="Blood type" value={detail.kanGrubu} />
                  <DetailItem label="Education" value={detail.egitimDurum} />
                  <DetailItem label="Emergency contact" value={detail.acilIletisim} />
                  <DetailItem label="Emergency phone" value={detail.acilIletisimTel} />
                  <DetailItem label="SSN" value={detail.sgkSicilNo} />
                  <DetailItem label="Bank" value={detail.bankaAdi} />
                  <DetailItem label="IBAN" value={detail.iban} />
                  {detail.status !== "PENDING" && (
                    <DetailItem label="Hire date" value={formatDate(detail.iseGirisTarihi)} />
                  )}
                  <DetailItem label="Termination" value={formatDate(detail.istenCikisTarihi)} />
                  <DetailItem label="Extra 1" value={detail.ekstra1} />
                  <DetailItem label="Extra 2" value={detail.ekstra2} />
                </dl>
              </div>

              {detail.status === "REJECTED" && detail.rejectionReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <span className="font-medium text-destructive">Rejection note: </span>
                  {detail.rejectionReason}
                </div>
              )}

              {detail.status === "APPROVED" && detail.approvedCalisanId && (
                <p className="text-sm text-muted-foreground">
                  Linked employee ID: <span className="font-mono">{detail.approvedCalisanId}</span>
                </p>
              )}

              {detail.status === "PENDING" && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">Assignment (required to approve)</p>
                  <p className="text-xs text-muted-foreground">
                    Hire date will be set to today&apos;s calendar date in Europe/Istanbul when you
                    approve.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="assign-dept">Department</Label>
                      <Select
                        value={assignDepartment || undefined}
                        onValueChange={(v) => {
                          setAssignDepartment(v)
                          if (v !== "Pilot") setAssignPilotRank("")
                        }}
                      >
                        <SelectTrigger id="assign-dept" className="w-full">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKER_REGISTRATION_DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {assignDepartment === "Pilot" && (
                      <div className="space-y-2">
                        <Label htmlFor="assign-rank">Pilot position</Label>
                        <Select
                          value={assignPilotRank || undefined}
                          onValueChange={setAssignPilotRank}
                        >
                          <SelectTrigger id="assign-rank" className="w-full">
                            <SelectValue placeholder="Captain / F/O" />
                          </SelectTrigger>
                          <SelectContent>
                            {PILOT_RANKS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex-col gap-2 border-0 p-0 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => setRejectOpen(true)}
                    >
                      <IconX className="mr-2 size-4" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        actionLoading ||
                        !assignDepartment ||
                        (assignDepartment === "Pilot" &&
                          !PILOT_RANKS.includes(assignPilotRank as (typeof PILOT_RANKS)[number]))
                      }
                      onClick={() =>
                        void approve(detail.id, assignDepartment, assignPilotRank)
                      }
                    >
                      Approve &amp; create worker
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              Optional message for internal records (applicant is not notified automatically).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionLoading || !detail}
              onClick={() => detail && void reject(detail.id)}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}
