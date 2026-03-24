import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardHome } from "@/components/dashboard-home"

import data from "./dashboard/data.json"

export default async function Home() {
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

  return <DashboardHome user={user} tableData={data} />
}
