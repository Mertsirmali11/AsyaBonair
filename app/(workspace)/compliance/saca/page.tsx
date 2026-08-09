import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canViewSacaForSession } from "@/lib/saca-access"
import { fetchSacaAuditRows } from "@/lib/saca-audits"
import { NavPageTitle } from "@/components/nav-page-title"
import { SacaClient } from "@/components/compliance/saca-client"

export default async function SacaPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user?.email ?? "", mode: "insensitive" } },
    select: { departman: true },
  })
  const canView = await canViewSacaForSession(
    calisan?.departman ?? session.user?.departman
  )
  if (!canView) redirect("/dashboard")

  const rows = await fetchSacaAuditRows()

  return (
    <>
      <NavPageTitle navKeys={["complianceMonitoring", "sacaScore"]} />
      <SacaClient initialRows={rows} />
    </>
  )
}
