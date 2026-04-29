import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { AiReportsClient } from "./ai-reports-client"
import { prisma } from "@/lib/prisma-server"

export default async function AiReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Kaç adet güncel manuel var — ilk yüklemede göstermek için
  const manualCount = await prisma.companyManual.count({ where: { isCurrent: true } })

  return (
    <>
      <SetWorkspacePageTitle title="AI Manual Assistant" />
      <AiReportsClient manualCount={manualCount} />
    </>
  )
}
