import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { prisma } from "@/lib/prisma-server"
import { NavPageTitle } from "@/components/nav-page-title"
import { ShgmMevzuatClient, type ShgmRegulationRow } from "@/components/compliance/shgm-mevzuat-client"
import { SHGM_CATEGORY_LABELS } from "@/lib/shgm/categories"

export default async function ShgmMevzuatPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    redirect("/dashboard")
  }

  const [regulations, categoryDefaults] = await Promise.all([
    prisma.shgmRegulation.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { _count: { select: { revisions: true } } },
    }),
    prisma.shgmCategoryDefaultDepartment.findMany(),
  ])

  const rows: ShgmRegulationRow[] = regulations.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    department: r.department,
    status: r.status,
    publishDate: r.publishDate ? r.publishDate.toISOString() : null,
    latestRevisionNo: r.latestRevisionNo,
    latestRevisionDate: r.latestRevisionDate ? r.latestRevisionDate.toISOString() : null,
    sourceUrl: r.sourceUrl,
    revisionCount: r._count.revisions,
  }))

  return (
    <>
      <NavPageTitle navKey="shgmMevzuat" />
      <ShgmMevzuatClient
        initialRows={rows}
        categoryLabels={SHGM_CATEGORY_LABELS}
        initialCategoryDefaults={categoryDefaults.map((d) => ({
          category: d.category,
          department: d.department,
        }))}
      />
    </>
  )
}
