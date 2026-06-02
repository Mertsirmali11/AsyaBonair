import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { TasksDashboard } from "./tasks-dashboard"

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.TASKS_ACTIONS]) {
    redirect("/dashboard")
  }

  return <TasksDashboard />
}