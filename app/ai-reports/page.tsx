import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AiReportsClient } from "./ai-reports-client"

export default async function AiReportsPage() {
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

  return (
    <DashboardLayout user={user} headerTitle="AI Report Creator">
      <AiReportsClient />
    </DashboardLayout>
  )
}
