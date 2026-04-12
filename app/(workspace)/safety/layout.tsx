import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { isAdminDepartment } from "@/lib/department-access"

export default async function SafetyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!isAdminDepartment(session.user?.departman)) {
    redirect("/dashboard")
  }
  return <>{children}</>
}
