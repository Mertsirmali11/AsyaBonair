import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  const showAuditPlanNav = canAccessAuditPlan(session.user?.email)

  return (
    <DashboardLayout user={user} showAuditPlanNav={showAuditPlanNav}>
      {children}
    </DashboardLayout>
  )
}
