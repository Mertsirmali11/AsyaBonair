import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { HazardInboxAttachmentsView } from "@/components/hazard-inbox-attachments-view"

export default async function HazardInboxAttachmentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params

  return (
    <div className="flex flex-col gap-6 p-6">
      <HazardInboxAttachmentsView reportId={id} />
    </div>
  )
}
