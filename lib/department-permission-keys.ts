export const DEPARTMENT_PERMISSION_KEYS = {
  COMPLIANCE_MONITORING: "compliance_monitoring",
  SAFETY_MANAGEMENT: "safety_management",
  CONFIGURATIONS_AREA: "configurations_area",
  /** Kullanılmıyor — Authorization matrisinde gizli; API/legacy için saklanıyor. */
  WORKER_APPROVAL: "worker_approval",
  MEETINGS: "meetings",
  TASKS_ACTIONS: "tasks_actions",
  CONTROLLED_DOCUMENTS: "controlled_documents",
  LEAVE_REQUESTS: "leave_requests",
  COMPANY_STATUS: "company_status",
  AI_REPORTS: "ai_reports",
} as const

export type DepartmentPermissionKey =
  (typeof DEPARTMENT_PERMISSION_KEYS)[keyof typeof DEPARTMENT_PERMISSION_KEYS]

const ORDERED_KEYS: DepartmentPermissionKey[] = [
  DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING,
  DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT,
  DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA,
  // DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL, // kullanılmıyor
  DEPARTMENT_PERMISSION_KEYS.MEETINGS,
  DEPARTMENT_PERMISSION_KEYS.TASKS_ACTIONS,
  DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS,
  DEPARTMENT_PERMISSION_KEYS.LEAVE_REQUESTS,
  DEPARTMENT_PERMISSION_KEYS.COMPANY_STATUS,
  DEPARTMENT_PERMISSION_KEYS.AI_REPORTS,
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
  // {
  //   key: DEPARTMENT_PERMISSION_KEYS.WORKER_APPROVAL,
  //   label: "Worker registration onayı",
  //   description:
  //     "Yeni çalışan kaydı inceleme / onay (ileride etkinleştirilirse matrise eklenir).",
  // },
  {
    key: DEPARTMENT_PERMISSION_KEYS.MEETINGS,
    label: "Meetings",
    description: "Toplantı planları menüsü ve sayfaları (varsayılan: Quality + Admin).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.TASKS_ACTIONS,
    label: "Tasks & Actions",
    description: "Görev ve aksiyon panosu (varsayılan: Quality + Admin).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS,
    label: "Controlled Documents",
    description:
      "Manueller, formlar ve doküman prosedürü (varsayılan: tüm departmanlar; Aircraft Settings hariç).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.LEAVE_REQUESTS,
    label: "Leave Requests",
    description: "İzin talepleri (varsayılan: tüm departmanlar).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.COMPANY_STATUS,
    label: "Company Status Board",
    description: "Şirket durum panosu (varsayılan: tüm departmanlar).",
  },
  {
    key: DEPARTMENT_PERMISSION_KEYS.AI_REPORTS,
    label: "AI Report Creator",
    description: "AI rapor oluşturucu (varsayılan: tüm departmanlar).",
  },
]
