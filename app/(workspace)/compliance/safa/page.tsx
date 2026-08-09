import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageSafaForSession } from "@/lib/safa-access"
import { NavPageTitle } from "@/components/nav-page-title"
import { SafaClient, type SafaInspectionRow } from "@/components/compliance/safa-client"

export default async function SafaPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user?.email ?? "", mode: "insensitive" } },
    select: { departman: true },
  })
  const canManage = await canManageSafaForSession(
    calisan?.departman ?? session.user?.departman
  )
  if (!canManage) redirect("/dashboard")

  const records = await prisma.safaInspection.findMany({
    orderBy: { inspectionDate: "desc" },
    take: 500,
    select: {
      id: true,
      inspectionDate: true,
      location: true,
      authority: true,
      aircraftRegistration: true,
      cat1Count: true,
      cat2Count: true,
      cat3Count: true,
      notes: true,
    },
  })

  const rows: SafaInspectionRow[] = records.map((r) => ({
    id: r.id,
    inspectionDate: r.inspectionDate.toISOString(),
    location: r.location,
    authority: r.authority,
    aircraftRegistration: r.aircraftRegistration,
    cat1Count: r.cat1Count,
    cat2Count: r.cat2Count,
    cat3Count: r.cat3Count,
    notes: r.notes,
  }))

  return (
    <>
      <NavPageTitle navKeys={["complianceMonitoring", "safaScore"]} />
      <SafaClient initialRows={rows} />
    </>
  )
}
