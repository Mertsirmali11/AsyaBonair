import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AiReportsClient } from "./ai-reports-client"
import { prisma } from "@/lib/prisma-server"

export default async function AiReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  const manualCount = await prisma.companyManual.count({ where: { isCurrent: true } })

  return (
    <DashboardLayout user={user} headerTitle="AI Manual Assistant">
      <AiReportsClient manualCount={manualCount} />
    </DashboardLayout>
  )
}
