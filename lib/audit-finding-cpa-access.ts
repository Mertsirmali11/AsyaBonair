import "server-only"

import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export type CpaResponsiblePersonCheck =
  | { ok: true; calisanId: number }
  | { ok: false; reason: "not_authenticated" | "no_calisan" | "not_found" | "not_assignee" }

/**
 * CPA/Root Cause cevabını YALNIZCA bulgunun AuditFinding.assignedToId ile eşleşen kişi
 * verebilir/düzenleyebilir/resubmit edebilir. Admin olmak (canAccessAuditPlan), bireysel/
 * departman auditee eşleşmesi (lib/audit-finding-auditee-access.ts — bulguyu GÖRÜNTÜLEMEK
 * için hâlâ kullanılıyor) veya başka hiçbir yetki burada YETERLİ DEĞİLDİR — bilinçli olarak
 * daha geniş auditee-access mantığını reuse ETMİYORUZ, çünkü o mantık tam olarak bu görevin
 * düzeltmeye çalıştığı gevşekliğin kaynağı.
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
    select: { assignedToId: true },
  })
  if (!finding) return { ok: false, reason: "not_found" }

  if (finding.assignedToId !== calisan.id) return { ok: false, reason: "not_assignee" }

  return { ok: true, calisanId: calisan.id }
}

export type CpaReviewerCheck =
  | { ok: true; calisanId: number | null }
  | { ok: false; reason: "not_authenticated" | "not_reviewer" | "self_review" }

/**
 * CPA review aksiyonları (Accept / Revision Request) YALNIZCA canAccessAuditPlan() yetkisine
 * sahip kullanıcılarda — bu, Manage Audit'teki TÜM diğer review aksiyonlarının (auditee
 * checklist submission accept/revision-request, Add Finding, Delete) zaten kullandığı AYNI
 * gate; yeni bir "Lead Auditor" rolü icat etmiyoruz. Ayrıca kendi gönderdiği CPA'yı kabul
 * edemesin diye (assignedTo kişi aynı zamanda admin listesindeyse) respondedById ile actor
 * eşleşmesi ayrıca engellenir.
 */
export async function requireCpaReviewer(
  userEmail: string | null | undefined,
  responseRespondedById: number | null
): Promise<CpaReviewerCheck> {
  if (!canAccessAuditPlan(userEmail)) return { ok: false, reason: "not_reviewer" }
  if (!userEmail?.trim()) return { ok: false, reason: "not_authenticated" }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (calisan && responseRespondedById !== null && calisan.id === responseRespondedById) {
    return { ok: false, reason: "self_review" }
  }
  return { ok: true, calisanId: calisan?.id ?? null }
}
