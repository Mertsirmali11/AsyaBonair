import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const docs = await prisma.auditPlanDocument.findMany({
    where: { auditPlanEntryId: entryId },
    orderBy: { createdAt: "desc" },
    include: { uploader: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(
    docs.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      uploadedByName: calisanName(d.uploader),
      createdAt: d.createdAt.toISOString(),
      // NULL (eski kayıt) → istemci tarafında "auditor" olarak ele alınır, geriye dönük uyumlu.
      source: d.source,
      submitterName: d.submitterName,
    }))
  )
}

/** Tarayıcı dosyayı doğrudan Supabase'e yükledikten sonra metadata'yı burada kaydeder. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({ where: { id: entryId }, select: { id: true } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const uploader = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true },
  })

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

  const created = await prisma.auditPlanDocument.createMany({
    data: valid.map((f) => ({
      auditPlanEntryId: entryId,
      fileName: f.fileName,
      storagePath: f.path,
      mimeType: f.mimeType ?? null,
      fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
      uploadedBy: uploader?.id ?? null,
    })),
  })

  try {
    const uploaderCalisan = uploader
      ? await prisma.calisan.findUnique({ where: { id: uploader.id }, select: { isim: true, soyisim: true } })
      : null
    const actorName = uploaderCalisan
      ? [uploaderCalisan.isim, uploaderCalisan.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
      : "Bilinmeyen kullanıcı"
    const names = valid.map((f) => f.fileName).join(", ")
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
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
