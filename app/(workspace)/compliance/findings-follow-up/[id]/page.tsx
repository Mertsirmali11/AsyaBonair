import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { FindingDetailClient } from "@/components/compliance/finding-detail-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

type Props = { params: Promise<{ id: string }> }

export default async function FindingDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const findingId = Number(id)
  if (!Number.isInteger(findingId) || findingId < 1) redirect("/compliance/findings-follow-up")

  // Giriş yapan kişinin calisan kaydını bul
  const calisan = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true, isim: true, soyisim: true },
      })
    : null

  return (
    <FindingDetailClient
      findingId={findingId}
      currentCalisanId={calisan?.id ?? null}
      isAdmin={canAccessAuditPlan(session.user?.email)}
    />
  )
}
