/**
 * DB'ye/sunucuya dokunmadan izole doğrulama: Finding visibility'nin saf (DB'siz) kısmı
 * (lib/audit-finding-visibility-scope.ts) doğru mu?
 *
 * Kapsanan kurallar:
 *  - "Tüm findings" özel yetkisi yalnızca gerçek departman Admin / Compliance Monitoring
 *    Department olduğunda verilir (bkz. lib/department-access.ts) — compliance_monitoring
 *    department permission'ının başka bir departmana (modül erişimi için) açık olması BUNU
 *    vermez (fonksiyon permission'ı parametre bile almaz — yapısal olarak decouple).
 *  - Limited scope (diğer herkes), BEŞİ DE OR, "yalnızca" bu beşi:
 *    (1) self (assignedToId), (2) own department (entry.auditeeDepartments),
 *    (3) aktif User Group üyeliği (assignedGroupId), (4) auditor olduğu denetim
 *    (entry.auditors), (5) denetime bireysel auditee/responsible person olarak atanmış
 *    (entry.auditees, departmanından bağımsız).
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
// Decoupling: compliance_monitoring PERMISSION'ı CAMO'ya açık olsa bile (modül erişimi için)
// isFullFindingVisibilityDepartment bunu HİÇ bilmiyor/sormuyor — imzası permission almıyor,
// yalnızca gerçek departman adına bakıyor. "Permission açık ama departman CAMO" senaryosunda
// hâlâ false dönmesi, iki kavramın DB'de fiilen ayrı olduğunun kanıtı.
check(
  "compliance_monitoring permission açık ama departman CAMO → tam görünürlük YOK (yalnızca limited scope)",
  isFullFindingVisibilityDepartment("CAMO"),
  false
)

// --- 2) findingMatchesLimitedScope: self / own department / aktif grup / auditor / bireysel auditee ---
const baseCandidate: FindingScopeCandidate = {
  assignedToId: null,
  assignedGroupId: null,
  entryAuditeeDepartments: [],
  entryAuditorCalisanIds: [],
  entryAuditeeCalisanIds: [],
}
const camoUser = (
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
  findingMatchesLimitedScope({ ...baseCandidate, assignedToId: 42 }, camoUser()),
  true
)
check(
  "başkasına atanmış, hiçbir eşleşme yok → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, assignedToId: 99 }, camoUser()),
  false
)
check(
  "own department (auditeeDepartments eşleşiyor) → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeDepartments: ["CAMO"] }, camoUser()),
  true
)
check(
  "farklı departman → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeDepartments: ["SMS"] }, camoUser()),
  false
)
check(
  "aktif grup üyeliği (assignedGroupId eşleşiyor) → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, assignedGroupId: 7 }, camoUser({ activeGroupIds: [7, 8] })),
  true
)
check(
  "gruba atanmış ama üyesi olmadığı bir grup → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, assignedGroupId: 9 }, camoUser({ activeGroupIds: [7, 8] })),
  false
)
check(
  "auditor olduğu denetime ait finding → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditorCalisanIds: [42] }, camoUser()),
  true
)
check(
  "auditor OLMADIĞI bir denetime ait finding → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditorCalisanIds: [1, 2, 3] }, camoUser()),
  false
)
check(
  "kriter 5: denetime bireysel auditee/responsible person olarak atanmış → görünür",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeCalisanIds: [42] }, camoUser()),
  true
)
check(
  "bireysel auditee OLMADIĞI bir denetim → görünmez",
  findingMatchesLimitedScope({ ...baseCandidate, entryAuditeeCalisanIds: [1, 2, 3] }, camoUser()),
  false
)
check(
  "hiçbir kritere uymuyor → görünmez",
  findingMatchesLimitedScope(baseCandidate, camoUser()),
  false
)

// --- 3) Kullanıcı tarafından istenen ek senaryolar (CAMO, birden fazla denetim) ---
// Audit A: CAMO kullanıcısı (calisanId 42) bireysel auditee olarak eklenmiş.
// Audit B: CAMO kullanıcısının hiçbir ilgisi yok (ne dept, ne grup, ne auditor, ne bireysel auditee).
const auditA_finding: FindingScopeCandidate = {
  ...baseCandidate,
  entryAuditeeCalisanIds: [42], // CAMO kullanıcısı bu denetime bireysel auditee
}
const auditB_finding: FindingScopeCandidate = {
  ...baseCandidate,
  entryAuditeeDepartments: ["SMS"],
  entryAuditorCalisanIds: [7],
  entryAuditeeCalisanIds: [8],
}

check(
  "CAMO kullanıcısı → unrelated finding (Audit B) görmez",
  findingMatchesLimitedScope(auditB_finding, camoUser()),
  false
)
check(
  "CAMO kullanıcısı → bireysel auditee olduğu Audit A'nın finding'ini görür",
  findingMatchesLimitedScope(auditA_finding, camoUser()),
  true
)
check(
  "CAMO kullanıcısı → Audit A'ya bireysel auditee olsa da BAŞKA bir denetimin (Audit B) finding'ini yine görmez",
  findingMatchesLimitedScope(auditB_finding, camoUser()),
  false
)
check(
  "Admin → her iki denetimin de finding'i dahil TÜMÜNÜ görür (isFullFindingVisibilityDepartment)",
  isFullFindingVisibilityDepartment("Admin"),
  true
)
check(
  "Compliance Monitoring Department → her iki denetimin de finding'i dahil TÜMÜNÜ görür",
  isFullFindingVisibilityDepartment("Compliance Monitoring Department"),
  true
)

if (failed > 0) {
  console.error(`\n${failed} case(s) FAILED`)
  process.exit(1)
}
console.log(`\nAll finding-visibility-scope cases passed.`)
