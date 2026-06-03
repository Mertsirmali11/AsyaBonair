import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  // Her compliance sayfası kendi yetki kontrolünü yapıyor.
  // findings-follow-up herkese açık; audit-plan/checklists kendi sayfalarında kontrol ediyor.
  return <>{children}</>
}
