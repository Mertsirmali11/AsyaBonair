export const DEPARTMENT_PERMISSION_KEYS = {
  COMPLIANCE_MONITORING: "compliance_monitoring",
  SAFETY_MANAGEMENT: "safety_management",
  CONFIGURATIONS_AREA: "configurations_area",
  WORKER_APPROVAL: "worker_approval",
} as const

export type DepartmentPermissionKey =
  (typeof DEPARTMENT_PERMISSION_KEYS)[keyof typeof DEPARTMENT_PERMISSION_KEYS]

const ORDERED_KEYS: DepartmentPermissionKey[] = [
  DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING,
  DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT,
  DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA,
  DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL,
]

const KNOWN = new Set<string>(ORDERED_KEYS)

export function isKnownDepartmentPermissionKey(
  k: string
): k is DepartmentPermissionKey {
  return KNOWN.has(k)
}

export function orderedDepartmentPermissionKeys(): readonly DepartmentPermissionKey[] {
  return ORDERED_KEYS
}

export type DepartmentPermissionCatalogEntry = {
  key: DepartmentPermissionKey
  label: string
  description: string
}

export const DEPARTMENT_PERMISSION_CATALOG: DepartmentPermissionCatalogEntry[] = [
  {
    key: DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING,
    label: "Compliance Monitoring",
    description:
      "Uyumluluk / denetim alanı menüsü ve ilgili sayfalar (Quality + Admin kod varsayımı).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT,
    label: "Safety Management System",
    description:
      "Güvenlik yönetim sistemi menüsü ve ilgili sayfalar (Admin kod varsayımı).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA,
    label: "Configurations",
    description:
      "Yapılandırma alanı (kullanıcı ayarları, departmanlar, yazışmalar vb. — HR/Quality/Admin kod varsayımı).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL,
    label: "Worker registration onayı",
    description:
      "Yeni çalışan kaydı inceleme / onay (ortam değişkeni ile genişletilebilir; yoksa yapılandırma ile aynı).",
  },
]
