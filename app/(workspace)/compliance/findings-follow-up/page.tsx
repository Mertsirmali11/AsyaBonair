import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { FindingsFollowUpClient } from "@/components/compliance/findings-follow-up-client"

export default async function FindingsFollowUpPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Herkese açık — API zaten admin/auditee filtrelemesini yapıyor
  return <FindingsFollowUpClient />
}
