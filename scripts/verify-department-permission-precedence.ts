/**
 * DB'ye/sunucuya dokunmadan izole doğrulama: Authorization matrisinin precedence kuralı
 * ("DB'de explicit satır varsa o kazanır, yoksa legacy/default'a düşülür") doğru mu?
 *
 * Neden bu script var: repoda bir test framework'ü (jest/vitest) yok. Bu, Audit Plan
 * yetki kaynağını Department Permissions matrisine taşıyan refactor'ün en kritik
 * davranışını (özellikle "kullanıcı Yetkilendirme ekranında bir izni Kapalı yaptıysa
 * legacy/default bunu tekrar Açık'a çeviremez" kuralını) prod DB'ye bağlanmadan
 * çalıştırılabilir şekilde doğrular.
 *
 * Çalıştırma: npx tsx scripts/verify-department-permission-precedence.ts
 */
import { resolveDepartmentPermissionsFromRows } from "@/lib/department-permissions-precedence"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"

const CM = DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING

type Case = {
  name: string
  rows: { permissionKey: string; allowed: boolean }[]
  departman: string | null | undefined
  expectCompliance: boolean
}

const cases: Case[] = [
  {
    name: "1) Admin departmanı + DB kaydı YOK → legacy default (Açık)",
    rows: [],
    departman: "Admin",
    expectCompliance: true,
  },
  {
    name: "2) Admin departmanı + DB'de EXPLICIT Kapalı → Kapalı kalmalı (legacy override ETMEMELİ)",
    rows: [{ permissionKey: CM, allowed: false }],
    departman: "Admin",
    expectCompliance: false,
  },
  {
    name: "3) Admin departmanı + DB'de EXPLICIT Açık → Açık (DB ile legacy zaten aynı yönde)",
    rows: [{ permissionKey: CM, allowed: true }],
    departman: "Admin",
    expectCompliance: true,
  },
  {
    name: "4) CAMO departmanı + DB kaydı YOK → legacy default (Kapalı, quality/admin değil)",
    rows: [],
    departman: "CAMO",
    expectCompliance: false,
  },
  {
    name: "5) CAMO departmanı + DB'de EXPLICIT Açık → Açık (legacy default'u override eder)",
    rows: [{ permissionKey: CM, allowed: true }],
    departman: "CAMO",
    expectCompliance: true,
  },
  {
    name: "6) Quality departmanı + DB kaydı YOK → legacy default (Açık)",
    rows: [],
    departman: "Quality",
    expectCompliance: true,
  },
  {
    name: "7) departman null/boş + DB kaydı yok → legacy default (Kapalı)",
    rows: [],
    departman: null,
    expectCompliance: false,
  },
]

let failed = 0
for (const c of cases) {
  const resolved = resolveDepartmentPermissionsFromRows(c.rows, c.departman)
  const actual = !!resolved[CM]
  const ok = actual === c.expectCompliance
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"} — ${c.name} (expected=${c.expectCompliance}, actual=${actual})`)
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} case(s) FAILED`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} precedence cases passed.`)
