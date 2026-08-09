import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageTrainingForSession } from "@/lib/training-access"
import { computeTrainingStatus } from "@/lib/training-status"
import { NavPageTitle } from "@/components/nav-page-title"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrainingClient,
  type CalisanLite,
  type TrainingRecordRow,
} from "@/components/compliance/training-client"

export default async function TrainingEmployeeDetailPage({
  params,
}: {
  params: Promise<{ calisanId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const viewerCalisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user?.email ?? "", mode: "insensitive" } },
    select: { departman: true },
  })
  const canManage = await canManageTrainingForSession(
    viewerCalisan?.departman ?? session.user?.departman
  )
  if (!canManage) redirect("/dashboard")

  const { calisanId } = await params
  const numericId = Number.parseInt(calisanId, 10)
  if (Number.isNaN(numericId)) notFound()

  const [employee, records, calisanlar] = await Promise.all([
    prisma.calisan.findUnique({
      where: { id: numericId },
      select: { id: true, isim: true, soyisim: true, departman: true },
    }),
    prisma.trainingRecord.findMany({
      where: { calisanId: numericId },
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

  if (!employee) notFound()

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

  const counts = { valid: 0, expiring: 0, expired: 0, "no-expiry": 0 } as Record<string, number>
  for (const r of rows) {
    const s = computeTrainingStatus(r.expiryDate ? new Date(r.expiryDate) : null)
    counts[s] += 1
  }

  const employeeName = `${employee.isim ?? ""} ${employee.soyisim ?? ""}`.trim() || `#${employee.id}`

  return (
    <>
      <NavPageTitle navKeys={["complianceMonitoring", "trainingTracking"]} />
      <div className="flex flex-col gap-4 p-4 pb-0 md:p-6 md:pb-0">
        <Button type="button" variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
          <Link href="/compliance/training">
            <ArrowLeft className="size-4" />
            Eğitim Takip listesine dön
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{employeeName}</h1>
            <p className="text-muted-foreground text-sm">{employee.departman ?? "—"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Geçerli: {counts.valid}
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Yaklaşan: {counts.expiring}
            </Badge>
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              Süresi Geçmiş: {counts.expired}
            </Badge>
          </div>
        </div>
      </div>
      <TrainingClient
        initialRows={rows}
        calisanlar={calisanlar as CalisanLite[]}
        fixedCalisanId={numericId}
      />
    </>
  )
}
