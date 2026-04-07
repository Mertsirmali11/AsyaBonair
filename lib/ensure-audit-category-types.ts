import { prisma } from "@/lib/prisma-server"
import { DEFAULT_AUDIT_CATEGORY_NAMES } from "@/lib/audit-category-types-defaults"

/** Tablo boşsa varsayılan kategori satırlarını ekler (idempotent). */
export async function ensureDefaultAuditCategoryTypes(): Promise<void> {
  const count = await prisma.auditCategoryType.count()
  if (count > 0) return
  await prisma.auditCategoryType.createMany({
    data: DEFAULT_AUDIT_CATEGORY_NAMES.map((name, i) => ({
      name,
      sortOrder: i,
      isActive: true,
    })),
  })
}
