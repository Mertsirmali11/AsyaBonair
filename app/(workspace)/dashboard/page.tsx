import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardHome } from "@/components/dashboard-home"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function Page() {
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

  const departmentPermissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman ?? null
  ).catch(() => ({} as import("@/lib/department-permissions-resolve").ResolvedDepartmentPermissions))

  return <DashboardHome user={user} departmentPermissions={departmentPermissions} />
}
