import { redirect, notFound } from "next/navigation"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { AircraftDetailClient } from "./aircraft-detail-client"

export default async function AircraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect("/login")

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
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
    <>
      <SetWorkspacePageTitle title={`${aircraft.register} — Documents`} />
      <AircraftDetailClient
        aircraft={{
          id: aircraft.id,
          register: aircraft.register,
          msn: aircraft.msn,
          isArchived: aircraft.isArchived,
        }}
        currentUserId={calisan?.id ?? 0}
      />
    </>
  )
}
