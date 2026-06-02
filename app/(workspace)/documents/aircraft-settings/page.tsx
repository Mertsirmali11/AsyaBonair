import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"
import { AircraftSettingsTable } from "@/components/aircraft-settings-table"

export default async function AircraftSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  if (
    !(await hasDepartmentPermission(
      session.user?.departman,
      DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
    ))
  ) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AircraftSettingsTable />
    </div>
  )
}
