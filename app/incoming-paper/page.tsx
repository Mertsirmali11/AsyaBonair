import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { IncomingPaperForm } from "@/components/incoming-paper-form"

export default async function IncomingPaperPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user} headerTitle="Incoming Correspondences">
      <div className="flex flex-1 flex-col p-6">
        <IncomingPaperForm userId={session.user?.id || ""} />
      </div>
    </DashboardLayout>
  )
}

