import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { NavPageTitle } from "@/components/nav-page-title"
import { ReportHazardForm } from "@/components/report-hazard-form"

export default async function ReportHazardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <>
      <NavPageTitle navKey="reportHazard" />
      <div className="flex flex-1 flex-col p-6">
        <ReportHazardForm userId={session.user?.id || ""} />
      </div>
    </>
  )
}

