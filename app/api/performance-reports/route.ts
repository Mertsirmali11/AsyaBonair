import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { prisma } from "@/lib/prisma-server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuditYearStat = {
  year: number
  total: number
  internal: number
  external: number
  saca: number
  safa: number
  /** external + saca + safa — bize gelen denetimler */
  incoming: number
  byCategory: { name: string; count: number }[]
}

export type FindingYearStat = {
  year: number
  total: number
  timelyClosed: number    // Closed + accepted response submittedAt <= dueDate
  closedLate: number      // Closed + no accepted response in time (or no dueDate comparison possible)
  closedNoDl: number      // Closed + dueDate null
  withExtension: number   // has AuditFindingExtension (any)
  overdue: number         // Open + dueDate < now
  openOnTrack: number     // Open + (dueDate null OR dueDate >= now)
  byDepartment: {
    departman: string
    total: number
    timelyClosed: number
    overdue: number
    withExtension: number
  }[]
}

export type HazardYearStat = {
  year: number
  total: number
  bySource: { source: string; count: number }[]
  byDepartment: { departman: string; count: number }[]
}

export type PerformanceReportsData = {
  years: number[]
  auditStats: AuditYearStat[]
  findingStats: FindingYearStat[]
  hazardStats: HazardYearStat[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyCategory(
  name: string
): "internal" | "external" | "saca" | "safa" | "other" {
  const n = name.toLowerCase()
  if (n.includes("saca")) return "saca"
  if (n.includes("safa")) return "safa"
  if (n.includes("iç") || n.includes("internal")) return "internal"
  if (n.includes("dış") || n.includes("dis") || n.includes("external"))
    return "external"
  return "other"
}

function getYear(d: Date): number {
  return d.getUTCFullYear()
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const permissions = await getResolvedDepartmentPermissionsForUser(
      session.user.departman
    )
    if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const currentYear = new Date().getUTCFullYear()
    const years = [currentYear - 2, currentYear - 1, currentYear]
    const rangeStart = new Date(Date.UTC(years[0], 0, 1))
    const rangeEnd = new Date(Date.UTC(currentYear + 1, 0, 1)) // exclusive
    const now = new Date()

    // ── Parallel DB queries ──
    const [auditEntries, findings, hazards] = await Promise.all([
      prisma.auditPlanEntry.findMany({
        where: { plannedDate: { gte: rangeStart, lt: rangeEnd } },
        select: {
          id: true,
          plannedDate: true,
          auditCategoryType: { select: { name: true } },
        },
      }),

      prisma.auditFinding.findMany({
        where: { initializedOn: { gte: rangeStart, lt: rangeEnd } },
        select: {
          id: true,
          initializedOn: true,
          status: true,
          dueDate: true,
          assignedTo: { select: { departman: true } },
          responses: {
            where: { cpaStatus: "Accepted" },
            select: { submittedAt: true },
            orderBy: { submittedAt: "asc" },
            take: 1,
          },
          extensions: {
            select: { id: true },
            take: 1,
          },
        },
      }),

      prisma.hazardReport.findMany({
        where: { eventDate: { gte: rangeStart, lt: rangeEnd } },
        select: {
          id: true,
          eventDate: true,
          sourceType: true,
          reporter: { select: { departman: true } },
        },
      }),
    ])

    // ── Build per-year audit stats ──
    const auditStatMap = new Map<number, AuditYearStat>()
    for (const y of years) {
      auditStatMap.set(y, {
        year: y,
        total: 0,
        internal: 0,
        external: 0,
        saca: 0,
        safa: 0,
        incoming: 0,
        byCategory: [],
      })
    }
    const auditCatCount = new Map<number, Map<string, number>>()
    for (const y of years) auditCatCount.set(y, new Map())

    for (const entry of auditEntries) {
      const y = getYear(entry.plannedDate)
      if (!auditStatMap.has(y)) continue
      const stat = auditStatMap.get(y)!
      stat.total++
      const catName = entry.auditCategoryType.name
      const cls = classifyCategory(catName)
      if (cls === "internal") stat.internal++
      else if (cls === "external") stat.external++
      else if (cls === "saca") stat.saca++
      else if (cls === "safa") stat.safa++

      const catMap = auditCatCount.get(y)!
      catMap.set(catName, (catMap.get(catName) ?? 0) + 1)
    }
    for (const [y, stat] of auditStatMap) {
      stat.incoming = stat.external + stat.saca + stat.safa
      const catMap = auditCatCount.get(y)!
      stat.byCategory = Array.from(catMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    }

    // ── Build per-year finding stats ──
    const findingStatMap = new Map<number, FindingYearStat>()
    for (const y of years) {
      findingStatMap.set(y, {
        year: y,
        total: 0,
        timelyClosed: 0,
        closedLate: 0,
        closedNoDl: 0,
        withExtension: 0,
        overdue: 0,
        openOnTrack: 0,
        byDepartment: [],
      })
    }
    type DeptAcc = {
      total: number
      timelyClosed: number
      overdue: number
      withExtension: number
    }
    const findingDeptMap = new Map<number, Map<string, DeptAcc>>()
    for (const y of years) findingDeptMap.set(y, new Map())

    for (const f of findings) {
      const y = getYear(f.initializedOn)
      if (!findingStatMap.has(y)) continue
      const stat = findingStatMap.get(y)!
      stat.total++

      const hasExtension = f.extensions.length > 0
      if (hasExtension) stat.withExtension++

      const firstAccepted = f.responses[0]
      let category: "timelyClosed" | "closedLate" | "closedNoDl" | "overdue" | "openOnTrack"

      if (f.status === "Closed") {
        if (!f.dueDate) {
          category = "closedNoDl"
          stat.closedNoDl++
        } else if (firstAccepted && firstAccepted.submittedAt <= f.dueDate) {
          category = "timelyClosed"
          stat.timelyClosed++
        } else {
          category = "closedLate"
          stat.closedLate++
        }
      } else {
        if (f.dueDate && f.dueDate < now) {
          category = "overdue"
          stat.overdue++
        } else {
          category = "openOnTrack"
          stat.openOnTrack++
        }
      }

      // Per-department aggregation
      const deptName = f.assignedTo?.departman ?? "Belirtilmemiş"
      const deptMap = findingDeptMap.get(y)!
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, { total: 0, timelyClosed: 0, overdue: 0, withExtension: 0 })
      }
      const da = deptMap.get(deptName)!
      da.total++
      if (category === "timelyClosed") da.timelyClosed++
      if (category === "overdue") da.overdue++
      if (hasExtension) da.withExtension++
    }
    for (const [y, stat] of findingStatMap) {
      const deptMap = findingDeptMap.get(y)!
      stat.byDepartment = Array.from(deptMap.entries())
        .map(([departman, d]) => ({ departman, ...d }))
        .sort((a, b) => b.total - a.total)
    }

    // ── Build per-year hazard stats ──
    const hazardStatMap = new Map<number, HazardYearStat>()
    for (const y of years) {
      hazardStatMap.set(y, { year: y, total: 0, bySource: [], byDepartment: [] })
    }
    const hazardSourceMap = new Map<number, Map<string, number>>()
    const hazardDeptMap = new Map<number, Map<string, number>>()
    for (const y of years) {
      hazardSourceMap.set(y, new Map())
      hazardDeptMap.set(y, new Map())
    }

    for (const h of hazards) {
      const y = getYear(h.eventDate)
      if (!hazardStatMap.has(y)) continue
      hazardStatMap.get(y)!.total++
      const src = h.sourceType ?? "Belirtilmemiş"
      const sm = hazardSourceMap.get(y)!
      sm.set(src, (sm.get(src) ?? 0) + 1)
      const dept = h.reporter?.departman ?? "Belirtilmemiş"
      const dm = hazardDeptMap.get(y)!
      dm.set(dept, (dm.get(dept) ?? 0) + 1)
    }
    for (const [y, stat] of hazardStatMap) {
      stat.bySource = Array.from(hazardSourceMap.get(y)!.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
      stat.byDepartment = Array.from(hazardDeptMap.get(y)!.entries())
        .map(([departman, count]) => ({ departman, count }))
        .sort((a, b) => b.count - a.count)
    }

    const data: PerformanceReportsData = {
      years,
      auditStats: years.map((y) => auditStatMap.get(y)!),
      findingStats: years.map((y) => findingStatMap.get(y)!),
      hazardStats: years.map((y) => hazardStatMap.get(y)!),
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("[GET /api/performance-reports]", e)
    return NextResponse.json({ error: "Veri yüklenemedi." }, { status: 500 })
  }
}
