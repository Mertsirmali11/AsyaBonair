import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import { prisma } from "@/lib/prisma-server"
import { NavPageTitle } from "@/components/nav-page-title"
import { MeetingsClient } from "./meetings-client"

export default async function MeetingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.MEETINGS]) {
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
      <NavPageTitle navKey="meetings" />
      <MeetingsClient calisanlar={calisanlar} meetingTypes={meetingTypes} />
    </>
  )
}
