"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  Building2,
  Hammer,
  Plane,
  Search,
  Users,
  Pencil,
  X,
  CheckCircle2,
  Briefcase,
  MapPin,
  History,
  CalendarSearch,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"
import { formatWorkLocationDateLabel } from "@/lib/company-status-dates"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  titleName: string | null
  isManager: boolean
  workLocation: string
  workLocationDate: string | null
  workLocationDateEnd?: string | null
  isOnLeave: boolean
  hasLog?: boolean
}

interface Props {
  data: Employee[]
  currentEmployeeId: number | null
  currentWorkLocation: string | null
  currentWorkLocationDate: string | null
  currentWorkLocationDateEnd?: string | null
}

// ─── Status config ────────────────────────────────────────────────────────────

const LOCATION_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>
    badge: string
    row: string
  }
> = {
  Office: {
    icon: Building2,
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    row: "",
  },
  Hangar: {
    icon: Hammer,
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    row: "",
  },
  Remote: {
    icon: Plane,
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    row: "",
  },
  Field: {
    icon: MapPin,
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    row: "",
  },
  OnDuty: {
    icon: Briefcase,
    badge: "bg-green-100 text-green-800 border-green-200",
    row: "",
  },
  OnLeave: {
    icon: Plane,
    badge: "bg-red-100 text-red-800 border-red-200",
    row: "bg-red-50/70 dark:bg-red-900/10",
  },
}

function getStatus(emp: Employee) {
  if (emp.isOnLeave) return "OnLeave"
  return emp.workLocation in LOCATION_CONFIG ? emp.workLocation : "Office"
}

function fullName(emp: Employee) {
  return [emp.isim, emp.soyisim].filter(Boolean).join(" ") || "—"
}

function todayISODate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.Office
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.badge
      )}
    >
      <Icon size={11} />
      {label}
    </span>
  )
}

// ─── Update Status Modal ──────────────────────────────────────────────────────

interface UpdateModalProps {
  open: boolean
  onClose: () => void
  initialLocation: string
  initialDateStart: string | null
  initialDateEnd: string | null
  onSaved: (
    location: string,
    dateStart: string | null,
    dateEnd: string | null
  ) => void
}

function UpdateModal({
  open,
  onClose,
  initialLocation,
  initialDateStart,
  initialDateEnd,
  onSaved,
}: UpdateModalProps) {
  const { t } = useLanguage()
  const cs = t.companyStatus

  const [location, setLocation] = useState(initialLocation || "Office")
  const [dateStart, setDateStart] = useState(initialDateStart ?? "")
  const [dateEnd, setDateEnd] = useState(initialDateEnd ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync with prop changes
  useEffect(() => {
    if (open) {
      setLocation(initialLocation || "Office")
      setDateStart(initialDateStart ?? "")
      setDateEnd(initialDateEnd ?? "")
      setError(null)
    }
  }, [open, initialLocation, initialDateStart, initialDateEnd])

  const locationOptions = [
    { value: "Office", label: cs.statusOffice },
    { value: "Hangar", label: cs.statusHangar },
    { value: "Remote", label: cs.statusRemote },
    { value: "Field", label: cs.statusField },
    { value: "OnDuty", label: cs.statusOnDuty },
  ]

  const handleSave = useCallback(async () => {
    if (dateStart && dateEnd && dateEnd < dateStart) {
      setError(cs.dateRangeInvalid)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/company-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workLocation: location,
          workLocationDate: dateStart || null,
          workLocationDateEnd: dateEnd || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? cs.updateError)
        return
      }
      onSaved(location, dateStart || null, dateEnd || null)
      onClose()
    } catch {
      setError(cs.updateError)
    } finally {
      setSaving(false)
    }
  }, [
    location,
    dateStart,
    dateEnd,
    cs.updateError,
    cs.dateRangeInvalid,
    onSaved,
    onClose,
  ])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">{cs.myStatusTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Location selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {cs.selectLocation}
          </label>
          <div className="grid grid-cols-1 gap-2">
            {locationOptions.map((opt) => {
              const cfg = LOCATION_CONFIG[opt.value]
              const Icon = cfg.icon
              const isSelected = location === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLocation(opt.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all text-left",
                    isSelected
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex-none rounded-full p-1.5",
                      isSelected ? "bg-primary/10" : "bg-muted"
                    )}
                  >
                    <Icon size={14} />
                  </span>
                  {opt.label}
                  {isSelected && (
                    <CheckCircle2
                      size={15}
                      className="ml-auto text-primary flex-none"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Date range */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {cs.selectDate}
          </label>
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            {cs.dateRangeHint}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {cs.dateFrom}
              </label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => {
                  const v = e.target.value
                  setDateStart(v)
                  if (dateEnd && v && dateEnd < v) setDateEnd("")
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                {cs.dateTo}
              </label>
              <input
                type="date"
                value={dateEnd}
                min={dateStart || undefined}
                disabled={!dateStart}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>
          {(dateStart || dateEnd) && (
            <button
              type="button"
              onClick={() => {
                setDateStart("")
                setDateEnd("")
              }}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              × {cs.clearDate}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            {cs.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "…" : cs.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanyStatusClient({
  data: initialData,
  currentEmployeeId,
  currentWorkLocation,
  currentWorkLocationDate,
  currentWorkLocationDateEnd = null,
}: Props) {
  const { t } = useLanguage()
  const cs = t.companyStatus

  const [data, setData] = useState<Employee[]>(initialData)
  const [modalOpen, setModalOpen] = useState(false)
  const [deptFilter, setDeptFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")

  // ── History date ────────────────────────────────────────────────────────────
  const [historyDate, setHistoryDate] = useState<string>("")
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isHistoryMode = historyDate !== ""

  // Fetch historical data whenever historyDate changes
  useEffect(() => {
    if (!historyDate) {
      setData(initialData)
      setHistoryError(null)
      return
    }
    // Don't fetch future dates
    if (historyDate > todayISODate()) {
      setData(initialData)
      setHistoryError(null)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setHistoryLoading(true)
    setHistoryError(null)

    fetch(`/api/company-status?date=${historyDate}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: { employees?: Employee[]; error?: string }) => {
        if (json.error) {
          setHistoryError(json.error)
        } else if (json.employees) {
          setData(json.employees)
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setHistoryError(cs.updateError)
      })
      .finally(() => setHistoryLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDate])

  // Status label lookup
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "Office":  return cs.statusOffice
      case "Hangar":  return cs.statusHangar
      case "OnLeave": return cs.onLeave
      case "Remote":  return cs.statusRemote
      case "Field":   return cs.statusField
      case "OnDuty":  return cs.statusOnDuty
      default:        return status
    }
  }

  // Called after successful save
  const handleSaved = useCallback(
    (
      location: string,
      dateStart: string | null,
      dateEnd: string | null
    ) => {
      // Only update live data if not in history mode
      if (!isHistoryMode) {
        setData((prev) =>
          prev.map((emp) =>
            emp.id === currentEmployeeId
              ? {
                  ...emp,
                  workLocation: location,
                  workLocationDate: dateStart,
                  workLocationDateEnd:
                    dateEnd && dateStart && dateEnd !== dateStart
                      ? dateEnd
                      : null,
                }
              : emp
          )
        )
      }
    },
    [currentEmployeeId, isHistoryMode]
  )

  // Current employee's row
  const currentEmp = useMemo(
    () => (!isHistoryMode ? data.find((e) => e.id === currentEmployeeId) ?? null : null),
    [data, currentEmployeeId, isHistoryMode]
  )
  const myLocation = currentEmp?.workLocation ?? currentWorkLocation ?? "Office"
  const myDateStart =
    currentEmp?.workLocationDate ?? currentWorkLocationDate ?? null
  const myDateEnd =
    currentEmp?.workLocationDateEnd ?? currentWorkLocationDateEnd ?? null
  const myDateLabel = formatWorkLocationDateLabel(myDateStart, myDateEnd)

  // Unique departments
  const departments = useMemo(() => {
    const depts = [
      ...new Set(data.map((e) => e.departman).filter(Boolean)),
    ] as string[]
    return depts.sort((a, b) => a.localeCompare(b, "tr"))
  }, [data])

  // Stats
  const stats = useMemo(() => {
    const onLeave  = data.filter((e) => e.isOnLeave).length
    const inOffice = data.filter((e) => !e.isOnLeave && e.workLocation === "Office").length
    const inHangar = data.filter((e) => !e.isOnLeave && e.workLocation === "Hangar").length
    const other    = data.length - onLeave - inOffice - inHangar
    return { total: data.length, onLeave, inOffice, inHangar, other }
  }, [data])

  // Filtered rows
  const filtered = useMemo(() => {
    return data.filter((emp) => {
      if (deptFilter !== "ALL" && emp.departman !== deptFilter) return false
      if (statusFilter !== "ALL") {
        const s = getStatus(emp)
        if (s !== statusFilter) return false
      }
      if (search) {
        const q     = search.toLowerCase()
        const name  = fullName(emp).toLowerCase()
        const dept  = (emp.departman ?? "").toLowerCase()
        const title = (emp.titleName ?? "").toLowerCase()
        if (!name.includes(q) && !dept.includes(q) && !title.includes(q)) return false
      }
      return true
    })
  }, [data, deptFilter, statusFilter, search])

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{cs.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{cs.subtitle}</p>
        </div>

        {/* "Update my status" button — only when viewing today */}
        {currentEmployeeId !== null && !isHistoryMode && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil size={14} />
              {cs.updateMyStatus}
            </button>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <StatusBadge
                status={!currentEmp?.isOnLeave ? myLocation : "OnLeave"}
                label={getStatusLabel(!currentEmp?.isOnLeave ? myLocation : "OnLeave")}
              />
              {myDateLabel && (
                <span className="text-muted-foreground">
                  {cs.dateLabel}: {myDateLabel}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── History date picker ─────────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        isHistoryMode
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700"
          : "border-border bg-muted/20"
      )}>
        <CalendarSearch
          size={16}
          className={isHistoryMode ? "text-amber-600" : "text-muted-foreground"}
        />
        <span className={cn(
          "text-sm font-medium",
          isHistoryMode ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {isHistoryMode ? cs.historyLabel : cs.historyDatePicker}
        </span>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input
            type="date"
            value={historyDate}
            max={todayISODate()}
            onChange={(e) => setHistoryDate(e.target.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background",
              isHistoryMode ? "border-amber-300" : "border-input"
            )}
          />
          {isHistoryMode && (
            <button
              type="button"
              onClick={() => setHistoryDate("")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors dark:bg-amber-900/20 dark:text-amber-400"
            >
              <X size={12} />
              {cs.historyToday}
            </button>
          )}
          {historyLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Yükleniyor…</span>
          )}
        </div>
      </div>

      {/* History error */}
      {historyError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {historyError}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: cs.totalStaff, value: stats.total,    color: "bg-card border-border",           icon: Users    },
          { label: cs.inOffice,   value: stats.inOffice,  color: "bg-blue-50 border-blue-200",      icon: Building2 },
          { label: cs.inHangar,   value: stats.inHangar,  color: "bg-orange-50 border-orange-200",  icon: Hammer   },
          { label: cs.onLeave,    value: stats.onLeave,   color: "bg-red-50 border-red-200",        icon: Plane    },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={cn("rounded-xl border p-4", color)}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              <Icon size={16} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={cs.searchPlaceholder}
            className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 flex-wrap">
          {[
            { key: "ALL",     label: cs.statusAll    },
            { key: "Office",  label: cs.statusOffice },
            { key: "Hangar",  label: cs.statusHangar },
            { key: "Remote",  label: cs.statusRemote },
            { key: "Field",   label: cs.statusField  },
            { key: "OnDuty",  label: cs.statusOnDuty },
            { key: "OnLeave", label: cs.onLeave      },
          ].map(({ key, label }) => (
            <button key={key} type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Department filter chips */}
      <div className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => setDeptFilter("ALL")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            deptFilter === "ALL"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}>
          {cs.allDepartments}
        </button>
        {departments.map((dept) => {
          const count = data.filter((e) => e.departman === dept).length
          return (
            <button key={dept} type="button"
              onClick={() => setDeptFilter(dept === deptFilter ? "ALL" : dept)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                deptFilter === dept
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}>
              {dept}
              <span className="ml-1 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">{cs.employee}</th>
              <th className="px-4 py-3 font-medium">{cs.department}</th>
              <th className="px-4 py-3 font-medium">{cs.titleColumn}</th>
              <th className="px-4 py-3 font-medium">{cs.locationStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  {isHistoryMode ? cs.historyNoData : cs.noEmployees}
                </td>
              </tr>
            ) : (
              filtered.map((emp) => {
                const status = getStatus(emp)
                const cfg    = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.Office
                const isMe   = emp.id === currentEmployeeId && !isHistoryMode
                return (
                  <tr key={emp.id}
                    className={cn(
                      "transition-colors hover:bg-muted/20",
                      cfg.row,
                      isMe && "ring-1 ring-inset ring-primary/20 bg-primary/5"
                    )}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                        {fullName(emp)}
                        {isMe && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                            Sen
                          </span>
                        )}
                        {emp.isManager && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {cs.manager}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {emp.departman ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {emp.titleName ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={status} label={getStatusLabel(status)} />
                        {/* Date label — only in today mode */}
                        {formatWorkLocationDateLabel(
                          emp.workLocationDate,
                          emp.workLocationDateEnd ?? null
                        ) &&
                          !emp.isOnLeave &&
                          !isHistoryMode && (
                          <span className="text-[11px] text-muted-foreground">
                            {cs.dateLabel}:{" "}
                            {formatWorkLocationDateLabel(
                              emp.workLocationDate,
                              emp.workLocationDateEnd ?? null
                            )}
                          </span>
                        )}
                        {/* In history mode, note if no log record existed */}
                        {isHistoryMode && emp.hasLog === false && (
                          <span className="text-[10px] text-muted-foreground/60 italic flex items-center gap-1">
                            <History size={9} />
                            {cs.noLogNote}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
          {isHistoryMode && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <History size={11} />
              {historyDate}
            </span>
          )}
          <span className="ml-auto">
            {filtered.length} / {data.length} {cs.showingCount}
          </span>
        </div>
      </div>

      {/* Update modal */}
      <UpdateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialLocation={myLocation}
        initialDateStart={myDateStart}
        initialDateEnd={myDateEnd}
        onSaved={handleSaved}
      />
    </div>
  )
}
