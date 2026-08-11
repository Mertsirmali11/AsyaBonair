import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

/**
 * GET: bulguya doğrudan yüklenmiş dosyalar — checklist madde eklerinden (AuditSessionItemAttachment)
 * ve Audit Files'tan (AuditPlanDocument) tamamen bağımsız, Finding ID altında saklanır.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const findingId = Number(id)
  if (!Number.isInteger(findingId) || findingId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(findingId, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const files = await prisma.auditFindingFile.findMany({
    where: { auditFindingId: findingId },
    orderBy: { createdAt: "desc" },
    include: { uploader: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(
    files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      fileSizeBytes: f.fileSizeBytes,
      uploadedByName: calisanName(f.uploader),
      createdAt: f.createdAt.toISOString(),
    }))
  )
}

/** Tarayıcı dosyayı doğrudan Supabase'e yükledikten sonra metadata'yı burada kaydeder. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const findingId = Number(id)
  if (!Number.isInteger(findingId) || findingId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(findingId, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const finding = await prisma.auditFinding.findUnique({ where: { id: findingId }, select: { id: true } })
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const uploader = authSession?.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: authSession.user.email, mode: "insensitive" } },
        select: { id: true, isim: true, soyisim: true },
      })
    : null

  const body = (await req.json().catch(() => null)) as {
    files?: { path: string; fileName: string; mimeType?: string; sizeBytes?: number }[]
  } | null
  const files = Array.isArray(body?.files) ? body!.files : []
  const valid = files.filter(
    (f): f is { path: string; fileName: string; mimeType?: string; sizeBytes?: number } =>
      !!f && typeof f.path === "string" && typeof f.fileName === "string"
  )
  if (valid.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }

  const created = await prisma.auditFindingFile.createMany({
    data: valid.map((f) => ({
      auditFindingId: findingId,
      fileName: f.fileName,
      storagePath: f.path,
      mimeType: f.mimeType ?? null,
      fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
      uploadedBy: uploader?.id ?? null,
    })),
  })

  try {
    const actorName = calisanName(uploader) ?? "Bilinmeyen kullanıcı"
    const names = valid.map((f) => f.fileName).join(", ")
    await prisma.auditFindingHistory.create({
      data: {
        auditFindingId: findingId,
        actorId: uploader?.id ?? null,
        eventType: "FILE_UPLOADED",
        note: `${valid.length} dosya (${names}) ${actorName} tarafından yüklendi.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile yükleme geçerli kalır
  }

  return NextResponse.json({ created: created.count }, { status: 201 })
}
