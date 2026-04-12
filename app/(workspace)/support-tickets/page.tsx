import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SupportTicketsClient } from "@/components/support-tickets-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function SupportTicketsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <SetWorkspacePageTitle title="Support Ticket" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <SupportTicketsClient />
      </div>
    </>
  )
}
