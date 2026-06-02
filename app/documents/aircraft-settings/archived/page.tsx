import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { AircraftSettingsTable } from "@/components/aircraft-settings-table"

export default async function ArchivedAircraftSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const departman = session.user?.departman
  const permissions = await getResolvedDepartmentPermissionsForUser(departman)
  if (
    !(await hasDepartmentPermission(
      departman,
      DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
    ))
  ) {
    redirect("/dashboard")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user} departmentPermissions={permissions}>
      <SetWorkspacePageTitle title="Archived aircrafts" />
      <div className="flex flex-col gap-6 p-6">
        <AircraftSettingsTable variant="archived" />
      </div>
    </DashboardLayout>
  )
}
