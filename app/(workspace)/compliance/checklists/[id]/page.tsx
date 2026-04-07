import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistDetailClient } from "@/components/compliance/audit-checklist-detail-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

type PageProps = { params: Promise<{ id: string }> }

export default async function AuditChecklistDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!canAccessAuditPlan(session.user?.email)) {
    redirect("/dashboard")
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    redirect("/compliance/checklists")
  }

  return <AuditChecklistDetailClient checklistId={id} />
}
