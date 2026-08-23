import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  FINDING_SCOPE_ENTRY_SELECT,
  extractFindingScopeCandidate,
  findingMatchesLimitedScope,
  resolveFindingVisibilityScope,
} from "@/lib/audit-finding-visibility"
import { prisma } from "@/lib/prisma-server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // TEK yetki kaynağı: lib/audit-finding-visibility.ts. "Tüm findings" YALNIZCA gerçek
  // departman Admin veya Compliance Monitoring Department ise verilir — compliance_monitoring
  // department permission'ının başka bir departmana (modül erişimi için) açık olması bunu tek
  // başına vermez. Diğer herkes: self / own department / aktif grup üyeliği / auditor olduğu
  // denetim eşleşmesiyle sınırlıdır (bkz. findingMatchesLimitedScope).
  const scope = await resolveFindingVisibilityScope(session.user.email, session.user.departman)
  if (scope.kind === "limited" && scope.calisanId == null) {
    return NextResponse.json([], { status: 200 })
  }

  const findings = await prisma.auditFinding.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true } },
      assignedGroup: { select: { id: true, name: true } },
      responses: {
        orderBy: { submittedAt: "asc" },
        select: { id: true, cpaStatus: true, submittedAt: true },
      },
      extensions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, newDueDate: true, status: true, isExpired: true },
      },
      session: {
        select: {
          auditPlanEntryId: true,
          entry: {
            select: {
              auditNumberPrefix: true,
              id: true,
              ...FINDING_SCOPE_ENTRY_SELECT,
            },
          },
        },
      },
      manualEntry: { select: FINDING_SCOPE_ENTRY_SELECT },
    },
  })

  const visible =
    scope.kind === "all"
      ? findings
      : findings.filter((f) => findingMatchesLimitedScope(extractFindingScopeCandidate(f), scope))

  // Compute summary stats for the response
  const now = new Date()
  const mapped = visible.map((f) => {
    const totalCpa = f.responses.length
    const acceptedCpa = f.responses.filter((r) => r.cpaStatus === "Accepted").length
    // "Rejected" artık üretilmiyor (bkz. cpaStatus akışı: Pending → RevisionRequested →
    // Resubmitted → Accepted) — bu özet sayaç yeni karşılığı olan RevisionRequested'i sayar.
    const rejectedCpa = f.responses.filter((r) => r.cpaStatus === "RevisionRequested").length
    const pendingCpa = f.responses.filter((r) => r.cpaStatus === "Pending" || r.cpaStatus === "Resubmitted").length
    const hasExtension = f.extensions.some((e) => e.status === "Approved")
    const extExpired = f.extensions.some((e) => e.status === "Approved" && e.isExpired)
    const isOverdue = f.status === "Open" && f.dueDate !== null && new Date(f.dueDate) < now
    const noCpa = f.status === "Open" && totalCpa === 0

    return {
      id: f.id,
      findingCode: f.findingCode,
      findingCategory: f.findingCategory,
      auditNumber: f.auditNumber,
      initializedOn: f.initializedOn.toISOString(),
      field: f.field,
      explanation: f.explanation,
      reference: f.reference,
      dueDate: f.dueDate?.toISOString() ?? null,
      status: f.status,
      assignedTo: f.assignedTo
        ? { id: f.assignedTo.id, name: [f.assignedTo.isim, f.assignedTo.soyisim].filter(Boolean).join(" ") }
        : null,
      assignedGroup: f.assignedGroup ? { id: f.assignedGroup.id, name: f.assignedGroup.name } : null,
      cpaRequests: `${totalCpa}/${acceptedCpa}/${rejectedCpa}`,
      // Findings Follow Up tablosunda "CPA Requests" sıralaması ekranda görünen
      // composite metni ("3/1/0") değil bu ham sayıları kullanır (bkz.
      // components/compliance/findings-follow-up-client.tsx sortKeyFor).
      totalCpa,
      acceptedCpa,
      rejectedCpa,
      pendingCpa,
      hasExtension,
      extExpired,
      isOverdue,
      noCpa,
    }
  })

  return NextResponse.json(mapped)
}
