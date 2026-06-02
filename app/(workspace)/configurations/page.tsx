import dynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { isAdminDepartment } from "@/lib/department-access"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

const UserManagement = dynamic(
  () => import("@/components/user-management").then((m) => ({ default: m.UserManagement })),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm">Loading user settings…</p>
    ),
  }
)

export default async function ConfigurationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (
    !(await hasDepartmentPermission(
      session.user?.departman,
      DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
    ))
  ) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · User settings"
      pageTitle="User settings"
      breadcrumbCurrent="User settings"
    >
      <UserManagement
        hidePageTitle
        title="User Settings"
        isAdminViewer={isAdminDepartment(session.user?.departman)}
      />
    </ConfigurationsPageShell>
  )
}
