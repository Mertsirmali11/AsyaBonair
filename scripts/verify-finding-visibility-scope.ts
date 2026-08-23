/**
 * DB'ye/sunucuya dokunmadan izole doğrulama: Finding visibility'nin saf (DB'siz) kısmı
 * (lib/audit-finding-visibility-scope.ts) doğru mu?
 *
 * Kapsanan kurallar:
 *  - "Tüm findings" özel yetkisi yalnızca gerçek departman Admin / Compliance Monitoring
 *    Department olduğunda verilir (bkz. lib/department-access.ts).
 *  - Limited scope: self (assignedToId) OR own department (auditeeDepartments) OR aktif User
 *    Group üyeliği (assignedGroupId) OR auditor olduğu denetim (entry.auditors).
 *
 * Çalıştırma: npx tsx scripts/verify-finding-visibility-scope.ts
 */
import { isFullFindingVisibilityDepartment } from "@/lib/department-access"
import {
  findingMatchesLimitedScope,
  type FindingScopeCandidate,
  type FindingVisibilityScope,
} from "@/lib/audit-finding-visibility-scope"

let failed = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"} — ${name} (expected=${expected}, actual=${actual})`)
}

// --- 1) isFullFindingVisibilityDepartment: yalnızca Admin / Compliance Monitoring Department ---
check("Admin departmanı → tam görünürlük", isFullFindingVisibilityDepartment("Admin"), true)
check(
  "Compliance Monitoring Department → tam görünürlük",
  isFullFindingVisibilityDepartment("Compliance Monitoring Department"),
  true
)
check(
  "compliance monitoring department (case/whitespace farkı) → tam görünürlük",
  isFullFindingVisibilityDepartment("  compliance monitoring department  "),
  true
)
check("CAMO → tam görünürlük YOK", isFullFindingVisibilityDepartment("CAMO"), false)
check("SMS → tam görünürlük YOK", isFullFindingVisibilityDepartment("SMS"), false)
check("Quality → tam görünürlük YOK (Admin/CMD değil)", isFullFindingVisibilityDepartment("Quality"), false)

// --- 2) findingMatchesLimitedScope: self / own department / aktif grup / auditor ---
const baseCandidate: FindingScopeCandidate = {
  assignedToId: null,
  assignedGroupId: null,
  entryAuditeeDepartments: [],
  entryAuditorCalisanIds: [],
}
const limitedScope = (
  over: Partial<Extract<FindingVisibilityScope, { kind: "limited" }>> = {}
): Extract<FindingVisibilityScope, { kind: "limited" }> => ({
  kind: "limited",
  calisanId: 42,
  departman: "CAMO",
  activeGroupIds: [],
  ...over,
})

check(
  "self (assignedToId eşleşiyor) → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, assignedToId: 42 }, limitedScope()),
  true
)
check(
  "başkasına atanmış, hiçbir eşleşme yok → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, assignedToId: 99 }, limitedScope()),
  false
)
check(
  "own department (auditeeDepartments eşleşiyor) → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeDepartments: ["CAMO"] }, limitedScope()),
  true
)
check(
  "farklı departman → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeDepartments: ["SMS"] }, limitedScope()),
  false
)
check(
  "aktif grup üyeliği (assignedGroupId eşleşiyor) → görünür",
  findingMatchesLimitedScope(
    { ...baseCandidate, assignedGroupId: 7 },
    limitedScope({ activeGroupIds: [7, 8] })
  ),
  true
)
check(
  "gruba atanmış ama üyesi olmadığı bir grup → görünmez",
  findingMatchesLimitedScope(
    { ...baseCandidate, assignedGroupId: 9 },
    limitedScope({ activeGroupIds: [7, 8] })
  ),
  false
)
check(
  "auditor olduğu denetime ait finding → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditorCalisanIds: [42] }, limitedScope()),
  true
)
check(
  "auditor OLMADIĞI bir denetime ait finding → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditorCalisanIds: [1, 2, 3] }, limitedScope()),
  false
)
check(
  "hiçbir kritere uymuyor → görünmez",
  findingMatchesLimitedScope(baseCandidate, limitedScope()),
  false
)

if (failed > 0) {
  console.error(`\n${failed} case(s) FAILED`)
  process.exit(1)
}
console.log(`\nAll finding-visibility-scope cases passed.`)
