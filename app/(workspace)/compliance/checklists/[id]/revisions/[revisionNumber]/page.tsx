import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistRevisionViewClient } from "@/components/compliance/audit-checklist-revision-view-client"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"

type PageProps = { params: Promise<{ id: string; revisionNumber: string }> }

export default async function AuditChecklistRevisionDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!(await hasDepartmentPermission(session.user?.departman, DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING))) {
    redirect("/dashboard")
  }

  const p = await params
  const id = Number(p.id)
  const rev = Number(p.revisionNumber)
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(rev)) {
    redirect("/compliance/checklists")
  }

  return <AuditChecklistRevisionViewClient checklistId={id} revisionNumber={rev} />
}
