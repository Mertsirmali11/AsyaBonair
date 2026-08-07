import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { NavPageTitle } from "@/components/nav-page-title"
import { IncomingPaperForm } from "@/components/incoming-paper-form"

export default async function IncomingPaperPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <NavPageTitle navKey="incomingCorrespondences" />
      <div className="flex flex-1 flex-col p-6">
        <IncomingPaperForm userId={session.user?.id || ""} />
      </div>
    </>
  )
}

