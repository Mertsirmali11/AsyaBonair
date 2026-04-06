import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { HazardReportManagement } from "@/components/hazard-report-management"

export default async function HazardInboxPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <HazardReportManagement />
    </div>
  )
}

