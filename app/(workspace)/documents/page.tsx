import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigManualsClient } from "@/components/config-manuals-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ControlledDocumentsPage() {
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
      <SetWorkspacePageTitle title="Controlled Documents · Manuals" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <ConfigManualsClient />
      </div>
    </>
  )
}
