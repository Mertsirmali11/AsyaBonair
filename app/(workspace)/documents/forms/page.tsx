import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DepartmentFormsClient } from "@/components/department-forms-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function DepartmentFormsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <SetWorkspacePageTitle title="Controlled Documents · Forms" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <DepartmentFormsClient />
      </div>
    </>
  )
}
