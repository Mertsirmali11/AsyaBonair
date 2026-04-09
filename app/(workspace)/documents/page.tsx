import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigManualsClient } from "@/components/config-manuals-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function ControlledDocumentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <SetWorkspacePageTitle title="Controlled Documents · Manuals" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <ConfigManualsClient />
      </div>
    </>
  )
}
