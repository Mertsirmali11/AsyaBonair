/**
 * AuditPlanEntry.auditType — Planned (yıllık Audit Plan), Unplanned (Plansız Denetimler) ve
 * Incoming (Gelen Denetimler) denetimleri AYNI tabloda/AYNI motorda ayırt eden tek alan.
 * Client ve server'da ortak kullanılabilsin diye bu dosyanın "server-only" işareti yoktur,
 * env değişkeni okumaz — bkz. lib/department-name-match.ts ile aynı prensip.
 */
export const AUDIT_PLAN_ENTRY_TYPES = ["PLANNED", "UNPLANNED", "INCOMING"] as const

export type AuditPlanEntryType = (typeof AUDIT_PLAN_ENTRY_TYPES)[number]

export function isAuditPlanEntryType(v: unknown): v is AuditPlanEntryType {
  return typeof v === "string" && (AUDIT_PLAN_ENTRY_TYPES as readonly string[]).includes(v)
}

/** Audit Settings'ten gelen `scopes` dizisini doğrular/temizler — bilinmeyen değerleri atar,
 * tekrarları temizler. Sonuç boşsa (hiç geçerli değer yoksa) `null` döner — çağıran taraf bunu
 * "gönderilmedi" gibi ele alıp varsayılana (["PLANNED"]) düşebilir. */
export function parseAuditPlanEntryTypeScopes(v: unknown): AuditPlanEntryType[] | null {
  if (!Array.isArray(v)) return null
  const cleaned = [...new Set(v.filter(isAuditPlanEntryType))]
  return cleaned.length > 0 ? cleaned : null
}

export type AuditPlanEntryTypeConfig = {
  /** Sayfa başlığı / sidebar etiketi */
  pageTitle: string
  /** "New Audit" dialog başlığı */
  createDialogTitle: string
  /** Kullanıcı boş bırakırsa Audit Number'da kullanılan varsayılan önek (ör. "AP-12") */
  defaultAuditNumberPrefix: string
  /** "Auditors" alanının bu tipte gösterilen etiketi (Incoming'de "Responsible Person(s)") */
  auditorsLabel: string
  /** "Auditees" alanının bu tipte gösterilen etiketi (Incoming'de "Responsible Department(s)") */
  auditeesLabel: string
}

export const AUDIT_PLAN_ENTRY_TYPE_CONFIG: Record<AuditPlanEntryType, AuditPlanEntryTypeConfig> = {
  PLANNED: {
    pageTitle: "Audit Plan",
    createDialogTitle: "Create New Audit",
    defaultAuditNumberPrefix: "AP",
    auditorsLabel: "Auditors",
    auditeesLabel: "Auditees",
  },
  UNPLANNED: {
    pageTitle: "Unplanned Audits",
    createDialogTitle: "Create New Audit",
    defaultAuditNumberPrefix: "UA",
    auditorsLabel: "Auditors",
    auditeesLabel: "Auditees",
  },
  INCOMING: {
    pageTitle: "Incoming Audits",
    createDialogTitle: "Register Incoming Audit",
    defaultAuditNumberPrefix: "IA",
    auditorsLabel: "Responsible Person(s)",
    auditeesLabel: "Responsible Department(s)",
  },
}
