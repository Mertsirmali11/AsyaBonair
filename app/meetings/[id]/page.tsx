import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma-server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MeetingDetailClient } from "./meeting-detail-client"

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user?.email ?? "" },
    select: { id: true, isim: true, soyisim: true, email: true, departman: true },
  })

  const user = {
    id: calisan?.id ?? 0,
    name: `${calisan?.isim ?? ""} ${calisan?.soyisim ?? ""}`.trim(),
    email: calisan?.email ?? "",
    avatar: "",
    departman: calisan?.departman,
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true, departman: true } } },
      },
    },
  })

  if (!meeting) notFound()

  const calisanlar = await prisma.calisan.findMany({
    select: { id: true, isim: true, soyisim: true },
    orderBy: { isim: "asc" },
  })

  const hazardReports = await prisma.hazardReport.findMany({
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      reportNo: true,
      title: true,
      eventDate: true,
      sourceType: true,
      reporter: { select: { isim: true, soyisim: true } },
    },
  })

  return (
    <DashboardLayout user={user} headerTitle={`Manage ${meeting.meetingNo} "${meeting.meetingType?.name}" Plan`}>
      <MeetingDetailClient
        meeting={meeting as any}
        calisanlar={calisanlar}
        hazardReports={hazardReports as any}
        currentUserName={user.name}
      />
    </DashboardLayout>
  )
}
