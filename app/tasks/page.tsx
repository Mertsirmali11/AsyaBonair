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

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return <TasksDashboard user={user} />
}