import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma-server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MeetingsClient } from "./meetings-client"

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { isim: true, soyisim: true, email: true, departman: true },
  })

  const user = {
    name: `${calisan?.isim ?? ""} ${calisan?.soyisim ?? ""}`.trim(),
    email: calisan?.email ?? "",
    avatar: "",
    departman: calisan?.departman,
  }

  const calisanlar = await prisma.calisan.findMany({
    select: { id: true, isim: true, soyisim: true, departman: true },
    orderBy: { isim: "asc" },
  })

  const meetingTypes = await prisma.meetingType.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <DashboardLayout user={user} headerTitle="Meetings">
      <MeetingsClient calisanlar={calisanlar} meetingTypes={meetingTypes} />
    </DashboardLayout>
  )
}
