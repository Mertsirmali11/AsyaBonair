import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { TasksDashboard } from "./tasks-dashboard"

export default async function TasksPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userDepartman = session.user?.departman
  if (userDepartman !== "Quality") {
    redirect("/dashboard")
  }

  return <TasksDashboard />
}