import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DepartmentFormsClient } from "@/components/department-forms-client"
import { NavPageTitle } from "@/components/nav-page-title"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function DepartmentFormsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (
    !(await hasDepartmentPermission(
      session.user?.departman,
      DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS
    ))
  ) {
    redirect("/dashboard")
  }

  return (
    <>
      <NavPageTitle navKeys={["controlledDocuments", "forms"]} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <DepartmentFormsClient />
      </div>
    </>
  )
}
