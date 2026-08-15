import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireCpaResponsiblePerson } from "@/lib/audit-finding-cpa-access"
import { prisma } from "@/lib/prisma-server"
import { uploadBinaryToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 30 * 1024 * 1024 // 30 MB

/**
 * CPA cevabına dosya eki — bu da "CPA create" akışının bir parçası, bu yüzden aynı
 * requireCpaResponsiblePerson kuralına tabi (önceden requireAuditPlanSession/admin-only idi,
 * bu yüzden gerçek sorumlu kişi bir auditee olarak cevap verebiliyor ama dosya EKLEYEMİYORDU —
 * bu düzeltmeyle birlikte giderildi).
 */
export async function POST(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const authSession = await auth()
  const check = await requireCpaResponsiblePerson(id, authSession?.user?.email)
  if (!check.ok) {
    return NextResponse.json({ error: "Yalnızca bu bulgunun sorumlu kişisi dosya ekleyebilir." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const responseIdRaw = formData.get("responseId")
  const responseId = Number(responseIdRaw)
  if (!Number.isInteger(responseId) || responseId < 1)
    return NextResponse.json({ error: "Invalid responseId" }, { status: 400 })

  // Verify response belongs to this finding AND was actually submitted by this same
  // responsible person — engeller: kendi cevabı olmayan (ör. eski/reddedilmiş, başkasına ait)
  // bir response'a dosya iliştirmeyi.
  const response = await prisma.auditFindingResponse.findFirst({
    where: { id: responseId, auditFindingId: id, respondedById: check.calisanId },
  })
  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 })

  const file = formData.get("file")
  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 413 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_") || "attachment"

  const uid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`

  const storageFileName = `${uid}_${safeName}`
  const folderPrefix = `audit-finding-attachments/${id}/${responseId}`

  const result = await uploadBinaryToStorage(
    folderPrefix,
    storageFileName,
    buffer,
    file.type || "application/octet-stream",
    { upsert: false }
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  const attachment = await prisma.auditFindingAttachment.create({
    data: {
      auditFindingResponseId: responseId,
      fileName: file.name,
      storagePath: result.path,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
    },
  })

  return NextResponse.json({ ...attachment, publicUrl: result.publicUrl }, { status: 201 })
}
