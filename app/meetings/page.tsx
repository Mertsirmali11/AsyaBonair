import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MeetingsClient } from "./meetings-client"

export default async function MeetingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

const userDepartman = session.user?.departman
if (userDepartman !== "Quality") {
  redirect("/dashboard")
}

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  const calisanlar = await prisma.calisan.findMany({
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
    },
    orderBy: { isim: "asc" },
  })

  const meetingTypesRaw = await prisma.meetingType.findMany({
    orderBy: { name: "asc" },
  })
  const meetingTypes = meetingTypesRaw.map((t) => ({
    id: Number(t.id),
    name: t.name,
  }))

  return (
    <DashboardLayout user={user} headerTitle="Meeting Plans">
      <MeetingsClient calisanlar={calisanlar} meetingTypes={meetingTypes} />
    </DashboardLayout>
  )
}
