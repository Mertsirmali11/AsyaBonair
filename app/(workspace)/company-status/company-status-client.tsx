"use client"

import { useState, useMemo } from "react"
import { Building2, Hammer, Plane, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  titleName: string | null
  isManager: boolean
  workLocation: string
  isOnLeave: boolean
}

// ─── Status config (styling only) ────────────────────────────────────────────

const LOCATION_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; badge: string; row: string }> = {
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
    icon: Plane,
    badge: "bg-amber-100 text-amber-800 border-amber-200",
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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.Office
  const Icon = cfg.icon
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      cfg.badge
    )}>
      <Icon size={11} />
      {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanyStatusClient({ data }: { data: Employee[] }) {
  const { t } = useLanguage()
  const cs = t.companyStatus

  const [deptFilter, setDeptFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")

  // Status label lookup using translations
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "Office":  return cs.statusOffice
      case "Hangar":  return cs.statusHangar
      case "OnLeave": return cs.onLeave
      case "Remote":  return cs.statusRemote
      case "Field":   return cs.statusField
      default:        return status
    }
  }

  // Unique departments
  const departments = useMemo(() => {
    const depts = [...new Set(data.map((e) => e.departman).filter(Boolean))] as string[]
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
      <div>
        <h1 className="text-xl font-bold">{cs.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{cs.subtitle}</p>
      </div>

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
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          {[
            { key: "ALL",     label: cs.statusAll    },
            { key: "Office",  label: cs.statusOffice },
            { key: "Hangar",  label: cs.statusHangar },
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
                  {cs.noEmployees}
                </td>
              </tr>
            ) : (
              filtered.map((emp) => {
                const status = getStatus(emp)
                const cfg    = LOCATION_CONFIG[status] ?? LOCATION_CONFIG.Office
                return (
                  <tr key={emp.id}
                    className={cn("transition-colors hover:bg-muted/20", cfg.row)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {fullName(emp)}
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
                      <StatusBadge status={status} label={getStatusLabel(status)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          {filtered.length} / {data.length} {cs.showingCount}
        </div>
      </div>
    </div>
  )
}
