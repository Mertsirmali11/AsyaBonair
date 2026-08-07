import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SupportTicketsClient } from "@/components/support-tickets-client"
import { NavPageTitle } from "@/components/nav-page-title"

export default async function SupportTicketsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <>
      <NavPageTitle navKey="supportTicket" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <SupportTicketsClient />
      </div>
    </>
  )
}
