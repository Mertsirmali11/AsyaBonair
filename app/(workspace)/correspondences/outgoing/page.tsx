import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { OutgoingCorrespondencesTable } from "@/components/outgoing-correspondences-table"

export default async function OutgoingCorrespondencesPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Outgoing Correspondences" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <OutgoingCorrespondencesTable userId={session.user?.id ?? ""} />
      </div>
    </>
  )
}
