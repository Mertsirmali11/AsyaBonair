import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { ReportHazardForm } from "@/components/report-hazard-form"

export default async function ReportHazardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Hazard Report" />
      <div className="flex flex-1 flex-col p-6">
        <ReportHazardForm userId={session.user?.id || ""} />
      </div>
    </>
  )
}

