import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma-server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TasksClient } from "./tasks-client"

export default async function TasksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { isim: true, soyisim: true, email: true, departman: true },
  })

  const user = {
    name: `${calisan?.isim ?? ""} ${calisan?.soyisim ?? ""}`.trim(),
    email: calisan?.email ?? "",
    avatar: "",
    departman: calisan?.departman,
  }

  return (
    <DashboardLayout user={user} headerTitle="Tasks & Actions">
      <TasksClient />
    </DashboardLayout>
  )
}
