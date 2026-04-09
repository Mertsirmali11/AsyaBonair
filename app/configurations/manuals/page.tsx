import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsManualsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  // Moved to Controlled Documents → Manuals
  redirect("/documents")
}
