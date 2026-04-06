import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { IncomingCorrespondencesTable } from "@/components/incoming-correspondences-table"

export default async function IncomingCorrespondencesPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Incoming Correspondences" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <IncomingCorrespondencesTable userId={session.user?.id ?? ""} />
      </div>
    </>
  )
}
