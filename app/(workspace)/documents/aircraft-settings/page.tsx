import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { AircraftSettingsTable } from "@/components/aircraft-settings-table"

export default async function AircraftSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AircraftSettingsTable />
    </div>
  )
}
