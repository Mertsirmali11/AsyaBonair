import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageTrainingForSession } from "@/lib/training-access"
import { NavPageTitle } from "@/components/nav-page-title"
import {
  TrainingClient,
  type CalisanLite,
  type TrainingRecordRow,
} from "@/components/compliance/training-client"

export default async function TrainingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user?.email ?? "", mode: "insensitive" } },
    select: { departman: true },
  })
  const canManage = await canManageTrainingForSession(
    calisan?.departman ?? session.user?.departman
  )
  if (!canManage) redirect("/dashboard")

  const [records, calisanlar] = await Promise.all([
    prisma.trainingRecord.findMany({
      orderBy: [{ expiryDate: "asc" }, { completionDate: "desc" }],
      select: {
        id: true,
        calisanId: true,
        trainingName: true,
        completionDate: true,
        expiryDate: true,
        certificateStoragePath: true,
        certificateFileName: true,
        notes: true,
        calisan: { select: { id: true, isim: true, soyisim: true, departman: true } },
      },
    }),
    prisma.calisan.findMany({
      select: { id: true, isim: true, soyisim: true, departman: true },
      orderBy: { isim: "asc" },
    }),
  ])

  const rows: TrainingRecordRow[] = records.map((r) => ({
    id: r.id,
    calisanId: r.calisanId,
    trainingName: r.trainingName,
    completionDate: r.completionDate.toISOString(),
    expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
    certificateStoragePath: r.certificateStoragePath,
    certificateFileName: r.certificateFileName,
    notes: r.notes,
    calisan: r.calisan,
  }))

  return (
    <>
      <NavPageTitle navKeys={["complianceMonitoring", "trainingTracking"]} />
      <TrainingClient initialRows={rows} calisanlar={calisanlar as CalisanLite[]} />
    </>
  )
}
