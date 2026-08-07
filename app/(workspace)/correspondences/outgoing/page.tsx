import { redirect } from "next/navigation"
import { auth } from "@/auth"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"
import { NavPageTitle } from "@/components/nav-page-title"
import { OutgoingCorrespondencesTable } from "@/components/outgoing-correspondences-table"

export default async function OutgoingCorrespondencesPage() {
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
      <NavPageTitle navKey="outgoingCorrespondences" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <OutgoingCorrespondencesTable userId={session.user?.id ?? ""} />
      </div>
    </>
  )
}
