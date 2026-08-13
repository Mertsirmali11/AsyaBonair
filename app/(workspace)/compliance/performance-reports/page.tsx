import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { NavPageTitle } from "@/components/nav-page-title"
import { PerformanceReportsClient } from "./performance-reports-client"
import type { PerformanceReportsData } from "@/app/api/performance-reports/route"

async function fetchPerformanceData(): Promise<PerformanceReportsData | null> {
  try {
    // Server-side'da base URL gerekli — internal fetch için absolute URL
    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
      `http://localhost:${process.env.PORT ?? 3000}`
    const res = await fetch(`${baseUrl}/api/performance-reports`, {
      cache: "no-store",
      headers: { "x-internal-fetch": "1" },
    })
    if (!res.ok) return null
    return (await res.json()) as PerformanceReportsData
  } catch {
    return null
  }
}

export default async function PerformanceReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    redirect("/dashboard")
  }

  // Prisma'yı doğrudan server component'ten çağır (API fetch yerine daha güvenilir)
  const { prisma } = await import("@/lib/prisma-server")
  const { prismaJson } = await import("@/lib/prisma-json")

  const currentYear = new Date().getUTCFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear]
  const rangeStart = new Date(Date.UTC(years[0], 0, 1))
  const rangeEnd = new Date(Date.UTC(currentYear + 1, 0, 1))
  const now = new Date()

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
      where: { deletedAt: null, initializedOn: { gte: rangeStart, lt: rangeEnd } },
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
        extensions: { select: { id: true }, take: 1 },
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

  // ── Audit aggregation ──────────────────────────────────────────────────────
  function classifyCategory(name: string) {
    const n = name.toLowerCase()
    if (n.includes("saca")) return "saca"
    if (n.includes("safa")) return "safa"
    if (n.includes("iç") || n.includes("internal")) return "internal"
    if (n.includes("dış") || n.includes("dis") || n.includes("external")) return "external"
    return "other"
  }
  function getYear(d: Date) { return d.getUTCFullYear() }

  type AuditYS = {
    year: number; total: number; internal: number; external: number;
    saca: number; safa: number; incoming: number;
    byCategory: { name: string; count: number }[]
  }
  const auditMap = new Map<number, AuditYS>()
  const auditCatCount = new Map<number, Map<string, number>>()
  for (const y of years) {
    auditMap.set(y, { year: y, total: 0, internal: 0, external: 0, saca: 0, safa: 0, incoming: 0, byCategory: [] })
    auditCatCount.set(y, new Map())
  }
  for (const e of auditEntries) {
    const y = getYear(e.plannedDate)
    if (!auditMap.has(y)) continue
    const s = auditMap.get(y)!
    s.total++
    const cls = classifyCategory(e.auditCategoryType.name)
    if (cls === "internal") s.internal++
    else if (cls === "external") s.external++
    else if (cls === "saca") s.saca++
    else if (cls === "safa") s.safa++
    const cm = auditCatCount.get(y)!
    cm.set(e.auditCategoryType.name, (cm.get(e.auditCategoryType.name) ?? 0) + 1)
  }
  for (const [y, s] of auditMap) {
    s.incoming = s.external + s.saca + s.safa
    s.byCategory = Array.from(auditCatCount.get(y)!.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  // ── Finding aggregation ────────────────────────────────────────────────────
  type FindingYS = {
    year: number; total: number; timelyClosed: number; closedLate: number;
    closedNoDl: number; withExtension: number; overdue: number; openOnTrack: number;
    byDepartment: { departman: string; total: number; timelyClosed: number; overdue: number; withExtension: number }[]
  }
  const findingMap = new Map<number, FindingYS>()
  type DA = { total: number; timelyClosed: number; overdue: number; withExtension: number }
  const findingDeptMap = new Map<number, Map<string, DA>>()
  for (const y of years) {
    findingMap.set(y, { year: y, total: 0, timelyClosed: 0, closedLate: 0, closedNoDl: 0, withExtension: 0, overdue: 0, openOnTrack: 0, byDepartment: [] })
    findingDeptMap.set(y, new Map())
  }
  for (const f of findings) {
    const y = getYear(f.initializedOn)
    if (!findingMap.has(y)) continue
    const s = findingMap.get(y)!
    s.total++
    const hasExt = f.extensions.length > 0
    if (hasExt) s.withExtension++
    const firstAcc = f.responses[0]
    type Cat = "timelyClosed" | "closedLate" | "closedNoDl" | "overdue" | "openOnTrack"
    let cat: Cat
    if (f.status === "Closed") {
      if (!f.dueDate) { cat = "closedNoDl"; s.closedNoDl++ }
      else if (firstAcc && firstAcc.submittedAt <= f.dueDate) { cat = "timelyClosed"; s.timelyClosed++ }
      else { cat = "closedLate"; s.closedLate++ }
    } else {
      if (f.dueDate && f.dueDate < now) { cat = "overdue"; s.overdue++ }
      else { cat = "openOnTrack"; s.openOnTrack++ }
    }
    const dept = f.assignedTo?.departman ?? "Belirtilmemiş"
    const dm = findingDeptMap.get(y)!
    if (!dm.has(dept)) dm.set(dept, { total: 0, timelyClosed: 0, overdue: 0, withExtension: 0 })
    const da = dm.get(dept)!
    da.total++
    if (cat === "timelyClosed") da.timelyClosed++
    if (cat === "overdue") da.overdue++
    if (hasExt) da.withExtension++
  }
  for (const [y, s] of findingMap) {
    s.byDepartment = Array.from(findingDeptMap.get(y)!.entries())
      .map(([departman, d]) => ({ departman, ...d }))
      .sort((a, b) => b.total - a.total)
  }

  // ── Hazard aggregation ─────────────────────────────────────────────────────
  type HazardYS = { year: number; total: number; bySource: { source: string; count: number }[]; byDepartment: { departman: string; count: number }[] }
  const hazardMap = new Map<number, HazardYS>()
  const hazardSrcMap = new Map<number, Map<string, number>>()
  const hazardDMap = new Map<number, Map<string, number>>()
  for (const y of years) {
    hazardMap.set(y, { year: y, total: 0, bySource: [], byDepartment: [] })
    hazardSrcMap.set(y, new Map())
    hazardDMap.set(y, new Map())
  }
  for (const h of hazards) {
    const y = getYear(h.eventDate)
    if (!hazardMap.has(y)) continue
    hazardMap.get(y)!.total++
    const src = h.sourceType ?? "Belirtilmemiş"
    const sm = hazardSrcMap.get(y)!
    sm.set(src, (sm.get(src) ?? 0) + 1)
    const dept = h.reporter?.departman ?? "Belirtilmemiş"
    const dm = hazardDMap.get(y)!
    dm.set(dept, (dm.get(dept) ?? 0) + 1)
  }
  for (const [y, s] of hazardMap) {
    s.bySource = Array.from(hazardSrcMap.get(y)!.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count)
    s.byDepartment = Array.from(hazardDMap.get(y)!.entries()).map(([departman, count]) => ({ departman, count })).sort((a, b) => b.count - a.count)
  }

  const data: PerformanceReportsData = {
    years,
    auditStats: years.map((y) => auditMap.get(y)!),
    findingStats: years.map((y) => findingMap.get(y)!),
    hazardStats: years.map((y) => hazardMap.get(y)!),
  }

  return (
    <>
      <NavPageTitle navKey="performanceReports" />
      <PerformanceReportsClient data={prismaJson(data) as PerformanceReportsData} />
    </>
  )
}
