import "server-only"

import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

type FindingAssignment = { assignedToId: number | null; assignedGroupId: number | null }

/**
 * Bir bulgunun sorumlu tarafı (kişi VEYA grup — karşılıklı dışlayıcı) ile verilen calisanId
 * eşleşiyor mu? Kişiye atanmışsa doğrudan id eşleşmesi; gruba atanmışsa AKTİF (istenCikisTarihi
 * null) bir UserGroupMember satırı var mı — client'tan gelen HİÇBİR bilgiye güvenilmez, her
 * çağrıda DB'den taze sorgulanır. hem CPA yazma (requireCpaResponsiblePerson) hem review
 * self-block (requireCpaReviewer) BU TEK fonksiyonu kullanır — iki ayrı mantık yoktur.
 */
async function isCalisanResponsibleFor(assignment: FindingAssignment, calisanId: number): Promise<boolean> {
  if (assignment.assignedToId != null) {
    return assignment.assignedToId === calisanId
  }
  if (assignment.assignedGroupId != null) {
    const membership = await prisma.userGroupMember.findFirst({
      where: {
        groupId: assignment.assignedGroupId,
        calisanId,
        calisan: { istenCikisTarihi: null },
      },
      select: { id: true },
    })
    return !!membership
  }
  return false
}

export type CpaResponsiblePersonCheck =
  | { ok: true; calisanId: number }
  | { ok: false; reason: "not_authenticated" | "no_calisan" | "not_found" | "not_assignee" }

/**
 * CPA/Root Cause cevabını YALNIZCA bulgunun sorumlu tarafı verebilir/düzenleyebilir/resubmit
 * edebilir: assignedToId doluysa o kişi, assignedGroupId doluysa o grubun AKTİF üyelerinden
 * biri (herhangi biri — ilk cevabı A verebilir, revizyonu B gönderebilir). Admin olmak
 * (canAccessAuditPlan), bireysel/departman auditee eşleşmesi (lib/audit-finding-auditee-access.ts
 * — bulguyu GÖRÜNTÜLEMEK için hâlâ kullanılıyor) veya grup DIŞINDAKİ başka hiçbir yetki burada
 * YETERLİ DEĞİLDİR. Gerçek cevabı gönderen kişi her zaman respondedById ile ayrıca kaydedilir
 * (bkz. çağıran route) — grup ataması bunu DEĞİŞTİRMEZ.
 */
export async function requireCpaResponsiblePerson(
  findingId: number,
  userEmail: string | null | undefined
): Promise<CpaResponsiblePersonCheck> {
  if (!userEmail?.trim()) return { ok: false, reason: "not_authenticated" }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (!calisan) return { ok: false, reason: "no_calisan" }

  const finding = await prisma.auditFinding.findFirst({
    where: { id: findingId, deletedAt: null },
    select: { assignedToId: true, assignedGroupId: true },
  })
  if (!finding) return { ok: false, reason: "not_found" }

  const isResponsible = await isCalisanResponsibleFor(finding, calisan.id)
  if (!isResponsible) return { ok: false, reason: "not_assignee" }

  return { ok: true, calisanId: calisan.id }
}

export type CpaReviewerCheck =
  | { ok: true; calisanId: number | null }
  | { ok: false; reason: "not_authenticated" | "not_reviewer" | "self_review" }

/**
 * CPA review aksiyonları (Accept / Revision Request) YALNIZCA canAccessAuditPlan() yetkisine
 * sahip kullanıcılarda — bu, Manage Audit'teki TÜM diğer review aksiyonlarının (auditee
 * checklist submission accept/revision-request, Add Finding, Delete) zaten kullandığı AYNI
 * gate; yeni bir "Lead Auditor" rolü icat etmiyoruz.
 *
 * Self-review engeli: bulgu kişiye atanmışsa o kişi, gruba atanmışsa GRUBUN HERHANGİ BİR
 * AKTİF ÜYESİ (yalnızca bu cevabı gönderen kişi değil — "grup üyesi kendi grubunun CPA'sını
 * review edememeli") kendi/grubunun CPA'sını inceleyemez.
 */
export async function requireCpaReviewer(
  findingId: number,
  userEmail: string | null | undefined
): Promise<CpaReviewerCheck> {
  if (!canAccessAuditPlan(userEmail)) return { ok: false, reason: "not_reviewer" }
  if (!userEmail?.trim()) return { ok: false, reason: "not_authenticated" }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (!calisan) return { ok: true, calisanId: null }

  const finding = await prisma.auditFinding.findFirst({
    where: { id: findingId, deletedAt: null },
    select: { assignedToId: true, assignedGroupId: true },
  })
  if (finding) {
    const isResponsible = await isCalisanResponsibleFor(finding, calisan.id)
    if (isResponsible) return { ok: false, reason: "self_review" }
  }

  return { ok: true, calisanId: calisan.id }
}

/**
 * Finding Detail UI'ının "hangi form/aksiyonları göstereceğine" karar vermek için — client'a
 * ham grup üyelik listesini SIZDIRMADAN (üye olmayanlara başkasının grup üyeliğini ifşa
 * etmeden) yalnızca iki boolean döner. Gerçek enforcement HER ZAMAN ilgili POST/PATCH
 * route'undaki requireCpaResponsiblePerson/requireCpaReviewer çağrısındadır — bu fonksiyon
 * yalnızca UI'ı doğru göstermek içindir, kendi başına bir yetki kapısı DEĞİLDİR.
 */
export async function computeCpaUiPermissions(
  findingId: number,
  userEmail: string | null | undefined
): Promise<{ canRespond: boolean; canReview: boolean }> {
  const [responder, reviewer] = await Promise.all([
    requireCpaResponsiblePerson(findingId, userEmail),
    requireCpaReviewer(findingId, userEmail),
  ])
  return { canRespond: responder.ok, canReview: reviewer.ok }
}
