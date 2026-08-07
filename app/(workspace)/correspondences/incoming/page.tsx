import { redirect } from "next/navigation"
import { auth } from "@/auth"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"
import { NavPageTitle } from "@/components/nav-page-title"
import { IncomingCorrespondencesTable } from "@/components/incoming-correspondences-table"

export default async function IncomingCorrespondencesPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (
    !(await hasDepartmentPermission(
      session.user?.departman,
      DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
    ))
  ) {
    redirect("/dashboard")
  }

  return (
    <>
      <NavPageTitle navKey="incomingCorrespondences" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <IncomingCorrespondencesTable userId={session.user?.id ?? ""} />
      </div>
    </>
  )
}
