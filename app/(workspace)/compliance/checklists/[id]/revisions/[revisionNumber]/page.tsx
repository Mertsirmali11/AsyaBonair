import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistRevisionViewClient } from "@/components/compliance/audit-checklist-revision-view-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

type PageProps = { params: Promise<{ id: string; revisionNumber: string }> }

export default async function AuditChecklistRevisionDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!canAccessAuditPlan(session.user?.email)) {
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
