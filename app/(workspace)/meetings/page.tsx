import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { isAdminDepartment } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { MeetingsClient } from "./meetings-client"

export default async function MeetingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userDepartman = session.user?.departman
  if (userDepartman !== "Quality" && !isAdminDepartment(userDepartman)) {
    redirect("/dashboard")
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
    code: t.code,
  }))

  return (
    <>
      <SetWorkspacePageTitle title="Meeting Plans" />
      <MeetingsClient calisanlar={calisanlar} meetingTypes={meetingTypes} />
    </>
  )
}
