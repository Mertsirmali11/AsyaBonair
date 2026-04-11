import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DocumentProcedureClient } from "@/components/document-procedure-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function DocumentProcedurePage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <SetWorkspacePageTitle title="Controlled Documents · Document Procedure" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <DocumentProcedureClient />
      </div>
    </>
  )
}
