import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

const MAX_NOTE_LENGTH = 5000

/**
 * Public Audit Response Link — denetlenen tarafın not/açıklama göndermesi.
 * Yalnızca INSERT yapar: gönderilen notlar kalıcıdır, bu uç noktadan düzenlenemez/silinemez
 * (public tarafta hiçbir PATCH/DELETE route'u yoktur — yetkili Bonjour kullanıcısı hariç).
 */
export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json(
      { error: responseLinkReasonMessage(validation.reason) },
      { status: 404 }
    )
  }

  const body = (await req.json().catch(() => null)) as {
    note?: string
    submitterName?: string
    submitterEmail?: string
  } | null

  const note = typeof body?.note === "string" ? body.note.trim() : ""
  if (!note) {
    return NextResponse.json({ error: "Not metni zorunludur." }, { status: 400 })
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Not en fazla ${MAX_NOTE_LENGTH} karakter olabilir.` }, { status: 400 })
  }

  const submitterName = typeof body?.submitterName === "string" ? body.submitterName.trim() : ""
  if (!submitterName) {
    return NextResponse.json({ error: "İsim zorunludur." }, { status: 400 })
  }
  const submitterEmail = typeof body?.submitterEmail === "string" ? body.submitterEmail.trim() : ""

  const created = await prisma.auditResponseNote.create({
    data: {
      auditPlanEntryId: validation.link.auditPlanEntryId,
      responseLinkId: validation.link.id,
      note,
      submitterName,
      submitterEmail: submitterEmail || null,
    },
  })

  try {
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: validation.link.auditPlanEntryId,
        actorId: null,
        eventType: "LINK_SUBMISSION",
        note: `Auditee remark submitted via external audit link by ${submitterName}.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile not kaydı geçerli kalır
  }

  return NextResponse.json({ ok: true, id: created.id, submittedAt: created.submittedAt.toISOString() }, { status: 201 })
}
