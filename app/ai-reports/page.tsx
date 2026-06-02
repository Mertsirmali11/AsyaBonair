import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AiReportsClient } from "./ai-reports-client"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function AiReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  const departman = session.user?.departman
  const permissions = await getResolvedDepartmentPermissionsForUser(departman)
  if (!(await hasDepartmentPermission(departman, DEPARTMENT_PERMISSION_KEYS.AI_REPORTS))) {
    redirect("/dashboard")
  }

  const manualCount = await prisma.companyManual.count({ where: { isCurrent: true } })

  const calisan = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { departman: true },
      })
    : null
  const isAdmin = isAdminDepartment(calisan?.departman ?? session.user?.departman)

  return (
    <DashboardLayout
      user={user}
      headerTitle="AI Manual Assistant"
      departmentPermissions={permissions}
    >
      <AiReportsClient manualCount={manualCount} isAdmin={isAdmin} />
    </DashboardLayout>
  )
}
