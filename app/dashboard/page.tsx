import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardHome } from "@/components/dashboard-home"

export default async function Page() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "Kullanıcı",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return <DashboardHome user={user} />
}
