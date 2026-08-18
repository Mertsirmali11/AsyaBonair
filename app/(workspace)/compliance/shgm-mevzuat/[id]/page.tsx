import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"

import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { prisma } from "@/lib/prisma-server"
import { NavPageTitle } from "@/components/nav-page-title"
import {
  ShgmMevzuatDetailClient,
  type ShgmRegulationDetail,
} from "@/components/compliance/shgm-mevzuat-detail-client"
import { SHGM_CATEGORY_LABELS } from "@/lib/shgm/categories"
import { mergeDepartmentLists } from "@/lib/organization-departments"

export default async function ShgmMevzuatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    redirect("/dashboard")
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) notFound()

  const [regulation, registeredDepartments] = await Promise.all([
    prisma.shgmRegulation.findUnique({
      where: { id: numericId },
      include: { revisions: { orderBy: { detectedAt: "desc" } } },
    }),
    prisma.customDepartment.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  if (!regulation) notFound()

  // Kayıtta zaten bir departman varsa ama kayıt listesinde yoksa (eski serbest
  // metin girişi) yine de seçenek olarak göster — veri kaybolmasın.
  const departmentOptions = mergeDepartmentLists(
    registeredDepartments.map((d) => d.name),
    regulation.department ? [regulation.department] : []
  )

  const detail: ShgmRegulationDetail = {
    id: regulation.id,
    title: regulation.title,
    category: regulation.category,
    department: regulation.department,
    status: regulation.status,
    sourceUrl: regulation.sourceUrl,
    publishDate: regulation.publishDate ? regulation.publishDate.toISOString() : null,
    aiSummary: regulation.aiSummary,
    aiSummaryUpdatedAt: regulation.aiSummaryUpdatedAt
      ? regulation.aiSummaryUpdatedAt.toISOString()
      : null,
    revisions: regulation.revisions.map((rev) => ({
      id: rev.id,
      kind: rev.kind,
      revisionNo: rev.revisionNo,
      revisionDate: rev.revisionDate ? rev.revisionDate.toISOString() : null,
      detectedAt: rev.detectedAt.toISOString(),
      hasPdf: Boolean(rev.pdfStoragePath),
      sourceUrl: rev.sourceUrl,
      emailSentAt: rev.emailSentAt ? rev.emailSentAt.toISOString() : null,
    })),
  }

  return (
    <>
      <NavPageTitle navKey="shgmMevzuat" />
      <ShgmMevzuatDetailClient
        detail={detail}
        categoryLabels={SHGM_CATEGORY_LABELS}
        departmentOptions={departmentOptions}
      />
    </>
  )
}
