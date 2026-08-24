import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

/** Tarayıcı dosyayı doğrudan Supabase'e yükledikten sonra metadata'yı burada kaydeder —
 * app/api/audit-plan/[id]/documents/route.ts POST ile aynı desen. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const revisionId = Number(id)
  if (!Number.isInteger(revisionId) || revisionId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const revision = await prisma.auditPlanRevision.findUnique({
    where: { id: revisionId },
    select: { id: true },
  })
  if (!revision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const uploader = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
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

  const created = await prisma.auditPlanRevisionFile.createMany({
    data: valid.map((f) => ({
      revisionId,
      fileName: f.fileName,
      storagePath: f.path,
      mimeType: f.mimeType ?? null,
      fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
      uploadedBy: uploader?.id ?? null,
    })),
  })

  return NextResponse.json({ created: created.count }, { status: 201 })
}
