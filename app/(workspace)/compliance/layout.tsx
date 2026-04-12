import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessQualityOrAdminSettings } from "@/lib/department-access"

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessQualityOrAdminSettings(session.user?.departman)) {
    redirect("/dashboard")
  }
  return <>{children}</>
}
