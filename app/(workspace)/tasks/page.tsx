import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { isAdminDepartment } from "@/lib/department-access"
import { TasksDashboard } from "./tasks-dashboard"

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userDepartman = session.user?.departman
  // Page visible to Quality + Admin; edits restricted to Admin in the API/UI.
  if (userDepartman !== "Quality" && !isAdminDepartment(userDepartman)) {
    redirect("/dashboard")
  }

  return <TasksDashboard />
}