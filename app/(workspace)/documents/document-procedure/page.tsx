import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DocumentProcedureClient } from "@/components/document-procedure-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function DocumentProcedurePage() {
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
      <SetWorkspacePageTitle title="Controlled Documents · Document Procedure" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <DocumentProcedureClient />
      </div>
    </>
  )
}
