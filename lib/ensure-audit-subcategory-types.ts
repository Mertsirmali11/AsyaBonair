import { prisma } from "@/lib/prisma-server"
import { DEFAULT_SUBCATEGORY_NAMES_BY_CATEGORY } from "@/lib/audit-subcategory-defaults"

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * İlk kurulumda (alt kategori tablosu tamamen boşken) varsayılan satırları ekler.
 * Sonradan silinen kayıtları GET isteğinde yeniden oluşturmaz — aksi halde kullanıcı
 * sildiği varsayılanları (ör. External → Regulator) listede tekrar görürdü.
 */
export async function ensureDefaultAuditSubCategoryTypes(): Promise<void> {
  const existingSubs = await prisma.auditSubCategoryType.count()
  if (existingSubs > 0) return

  const categories = await prisma.auditCategoryType.findMany({
    select: { id: true, name: true },
  })
  const byNorm = new Map<string, { id: number; name: string }>()
  for (const c of categories) {
    byNorm.set(normalizeName(c.name), c)
  }

  for (const [catName, subs] of Object.entries(DEFAULT_SUBCATEGORY_NAMES_BY_CATEGORY)) {
    const cat = byNorm.get(normalizeName(catName))
    if (!cat) continue

    const existing = await prisma.auditSubCategoryType.findMany({
      where: { auditCategoryTypeId: cat.id },
      select: { name: true },
    })
    const have = new Set(existing.map((e) => normalizeName(e.name)))

    let order = existing.length
    for (const subName of subs) {
      if (have.has(normalizeName(subName))) continue
      await prisma.auditSubCategoryType.create({
        data: {
          auditCategoryTypeId: cat.id,
          name: subName,
          sortOrder: order++,
          isActive: true,
        },
      })
    }
  }
}
