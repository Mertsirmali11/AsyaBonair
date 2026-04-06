import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function ControlledDocumentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <SetWorkspacePageTitle title="Controlled Documents" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          Manage controlled documentation from this section. Use Aircraft Settings below for
          aircraft certificates and manuals.
        </p>
      </div>
    </>
  )
}
