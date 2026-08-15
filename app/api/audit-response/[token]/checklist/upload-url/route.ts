import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import {
  FINDING_FILE_ALLOWED_ERROR_EN,
  isAllowedFindingFileName,
} from "@/lib/allowed-document-uploads"
import { assignSafeUniqueFileNames } from "@/lib/audit-response-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

const MAX_BYTES = 30 * 1024 * 1024
const MAX_FILES = 10

const ALLOWED_EXT_FOR_NAMING = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
  ".txt", ".csv", ".zip", ".rtf", ".odt", ".ods", ".odp",
])

/**
 * Public Audit Response Link — checklist sorusuna dosya eklemek için imzalı Supabase upload
 * URL'i. Genel Audit Files ile karışmasın diye ayrı bir storage klasörü kullanır
 * (audit-checklist-submissions/{entryId}/{checklistItemId}/...) — genel dosya yükleme
 * route'undan (files/upload-url) bilerek AYRI tutulur.
 *
 * `checklistItemId` (AuditChecklistItem.id) kullanılır — `sessionItemId` DEĞİL: dosya
 * seçimi/yükleme, o soru için henüz hiçbir AuditSessionItem oluşmadan da yapılabilmeli
 * (AuditSessionItem yalnızca gerçek submit anında, POST /checklist/[checklistItemId] içinde
 * idempotent olarak oluşturulur — bkz. ensureActiveAuditSessionItem).
 */
export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json({ error: responseLinkReasonMessage(validation.reason) }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    checklistItemId?: number
    files?: { name: string; size: number }[]
  } | null

  const checklistItemId = Number(body?.checklistItemId)
  if (!Number.isInteger(checklistItemId) || checklistItemId < 1) {
    return NextResponse.json({ error: "Invalid checklistItemId" }, { status: 400 })
  }

  // Bu checklist maddesi gerçekten bu link'in bağlı olduğu denetime ATANMIŞ bir checklist'e mi
  // ait — kritik güvenlik kontrolü, aksi halde token sahibi id tahmin ederek başka denetimlere
  // dosya ekleyebilir.
  const clItem = await prisma.auditChecklistItem.findFirst({
    where: {
      id: checklistItemId,
      checklist: { assignments: { some: { auditPlanEntryId: validation.link.auditPlanEntryId } } },
    },
    select: { id: true },
  })
  if (!clItem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const files = Array.isArray(body?.files) ? body!.files : []
  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }
  for (const f of files) {
    if ((Number(f?.size) || 0) > MAX_BYTES) {
      return NextResponse.json(
        { error: `Dosya çok büyük (en fazla ${MAX_BYTES / (1024 * 1024)} MB): ${f?.name ?? ""}` },
        { status: 413 }
      )
    }
  }

  const names = files.map((f) => String(f?.name ?? "").trim())
  for (const name of names) {
    if (!name || !isAllowedFindingFileName(name)) {
      return NextResponse.json({ error: FINDING_FILE_ALLOWED_ERROR_EN }, { status: 400 })
    }
  }

  const finalNames = assignSafeUniqueFileNames(names, ALLOWED_EXT_FOR_NAMING)
  const entryId = validation.link.auditPlanEntryId
  const uploads: { originalName: string; fileName: string; path: string; signedUrl: string; token: string }[] = []

  for (let i = 0; i < files.length; i++) {
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const path = `audit-checklist-submissions/${entryId}/${checklistItemId}/${uid}_${finalNames[i]}`
    const result = await createSignedUploadUrl(path)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })
    uploads.push({ originalName: names[i], fileName: finalNames[i], path: result.path, signedUrl: result.signedUrl, token: result.token })
  }

  return NextResponse.json({ uploads, bucket: getStorageBucket() })
}
