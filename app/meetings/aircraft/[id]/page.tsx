import { redirect, notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AircraftDetailClient } from "../../aircraft-detail-client"

type Props = { params: Promise<{ id: string }> }

export default async function AircraftDocumentsPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { id: true },
  })

  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) notFound()

  const aircraft = await prisma.ucaklar.findUnique({
    where: { id: numericId },
  })

  if (!aircraft) notFound()

  return (
    <DashboardLayout
      user={user}
      headerTitle={`${aircraft.register} — Documents`}
    >
      <AircraftDetailClient
        aircraft={aircraft}
        currentUserId={calisan?.id ?? 0}
      />
    </DashboardLayout>
  )
}
