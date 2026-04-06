import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { IncomingPaperForm } from "@/components/incoming-paper-form"

export default async function IncomingPaperPage() {
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
      <div className="flex flex-1 flex-col p-6">
        <IncomingPaperForm userId={session.user?.id || ""} />
      </div>
    </>
  )
}

