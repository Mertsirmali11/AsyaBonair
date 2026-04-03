import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"

export default async function ControlledDocumentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user} headerTitle="Controlled Documents">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          Manage controlled documentation from this section. Use Aircraft Settings below for
          aircraft certificates and manuals.
        </p>
      </div>
    </DashboardLayout>
  )
}
