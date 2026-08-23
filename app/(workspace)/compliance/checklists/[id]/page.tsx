import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistDetailClient } from "@/components/compliance/audit-checklist-detail-client"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"

type PageProps = { params: Promise<{ id: string }> }

export default async function AuditChecklistDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!(await hasDepartmentPermission(session.user?.departman, DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING))) {
    redirect("/dashboard")
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    redirect("/compliance/checklists")
  }

  return <AuditChecklistDetailClient checklistId={id} />
}
