import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

/**
 * Public Audit Response Link — tarayıcı dosyayı doğrudan Supabase'e yükledikten sonra
 * metadata'yı burada kalıcı olarak kaydeder (AuditPlanDocument, source="auditee").
 * Bu kayıtlar Manage Audit → Audit Files listesinde "Submitted by Auditee" olarak görünür
 * ve yalnızca yetkili bir Bonjour kullanıcısı tarafından silinebilir.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json({ error: responseLinkReasonMessage(validation.reason) }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    files?: { path: string; fileName: string; mimeType?: string; sizeBytes?: number }[]
    submitterName?: string
    submitterEmail?: string
  } | null

  const files = Array.isArray(body?.files) ? body!.files : []
  const valid = files.filter(
    (f): f is { path: string; fileName: string; mimeType?: string; sizeBytes?: number } =>
      !!f && typeof f.path === "string" && typeof f.fileName === "string"
  )
  if (valid.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }

  const submitterName = typeof body?.submitterName === "string" ? body.submitterName.trim() : ""
  if (!submitterName) {
    return NextResponse.json({ error: "İsim zorunludur." }, { status: 400 })
  }
  const submitterEmail = typeof body?.submitterEmail === "string" ? body.submitterEmail.trim() : ""

  const entryId = validation.link.auditPlanEntryId

  const created = await prisma.auditPlanDocument.createMany({
    data: valid.map((f) => ({
      auditPlanEntryId: entryId,
      fileName: f.fileName,
      storagePath: f.path,
      mimeType: f.mimeType ?? null,
      fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
      uploadedBy: null,
      source: "auditee",
      responseLinkId: validation.link.id,
      submitterName,
      submitterEmail: submitterEmail || null,
    })),
  })

  try {
    const names = valid.map((f) => f.fileName).join(", ")
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: null,
        eventType: "LINK_SUBMISSION",
        note: `${valid.length} file${valid.length === 1 ? "" : "s"} (${names}) submitted by ${submitterName} via external audit link.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile dosya kaydı geçerli kalır
  }

  return NextResponse.json({ ok: true, created: created.count }, { status: 201 })
}
