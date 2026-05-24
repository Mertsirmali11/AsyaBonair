import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AiReportsClient } from "./ai-reports-client"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

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

  const calisan = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { departman: true },
      })
    : null
  const isAdmin = isAdminDepartment(calisan?.departman ?? session.user?.departman)

  return (
    <DashboardLayout user={user} headerTitle="AI Manual Assistant">
      <AiReportsClient manualCount={manualCount} isAdmin={isAdmin} />
    </DashboardLayout>
  )
}
