import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import {
  FINDING_FILE_ALLOWED_ERROR_EN,
  isAllowedFindingFileName,
} from "@/lib/allowed-document-uploads"
import { assignSafeUniqueFileNames } from "@/lib/audit-response-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 30 * 1024 * 1024
const MAX_FILES = 10

// Aynı güvenli allow-list — Audit Response Files ve Finding Files ile ortak:
// PDF/Word/Excel/PowerPoint/görsel/CSV/TXT/ZIP ve birkaç güvenli ek biçim; exe/bat/js/vbs vb. reddedilir.
const ALLOWED_EXT_FOR_NAMING = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
  ".txt", ".csv", ".zip", ".rtf", ".odt", ".ods", ".odp",
])

/** POST: Planner task ekleri için imzalı Supabase upload URL'i — mevcut direct-to-Supabase deseni. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { files?: { name: string; size: number }[] } | null
  const files = Array.isArray(body?.files) ? body!.files : []
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 })
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  for (const f of files) {
    if ((Number(f?.size) || 0) > MAX_BYTES) {
      return NextResponse.json({ error: `Dosya çok büyük (en fazla ${MAX_BYTES / (1024 * 1024)} MB): ${f?.name ?? ""}` }, { status: 413 })
    }
  }

  const names = files.map((f) => String(f?.name ?? "").trim())
  for (const name of names) {
    if (!name || !isAllowedFindingFileName(name)) {
      return NextResponse.json({ error: FINDING_FILE_ALLOWED_ERROR_EN }, { status: 400 })
    }
  }

  const finalNames = assignSafeUniqueFileNames(names, ALLOWED_EXT_FOR_NAMING)
  const uploads: { originalName: string; fileName: string; path: string; signedUrl: string; token: string }[] = []

  for (let i = 0; i < files.length; i++) {
    const uid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const path = `planner-task-attachments/${taskId}/${uid}_${finalNames[i]}`
    const result = await createSignedUploadUrl(path)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })
    uploads.push({ originalName: names[i], fileName: finalNames[i], path: result.path, signedUrl: result.signedUrl, token: result.token })
  }

  return NextResponse.json({ uploads, bucket: getStorageBucket() })
}
