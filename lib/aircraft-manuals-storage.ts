import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

export function getAircraftManualsBucket(): string {
  return (
    process.env.SUPABASE_AIRCRAFT_MANUALS_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_AIRCRAFT_MANUALS_BUCKET ||
    "Aircraft-Manuals"
  )
}

let supabaseAdminInstance: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) return supabaseAdminInstance
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not set.")
  }
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return supabaseAdminInstance
}

export function sanitizeRegisterSegment(register: string): string {
  const s = register.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
  return s || "unknown"
}

const MAX_PDF_BYTES = 50 * 1024 * 1024

export async function uploadAircraftManualPdf(
  file: File,
  register: string,
  category: "certificate" | "manual"
): Promise<{ path: string; fileName: string } | null> {
  try {
    if (file.size > MAX_PDF_BYTES) return null
    if (file.type !== "application/pdf") return null

    const reg = sanitizeRegisterSegment(register)
    const safe =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/\s+/g, "_") || "document.pdf"
    const storagePath = `${reg}/${category}/${Date.now()}_${safe}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = getSupabaseAdmin()
    const bucket = getAircraftManualsBucket()
    const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    })
    if (error) throw error
    return { path: storagePath, fileName: file.name }
  } catch {
    return null
  }
}

export async function downloadAircraftManualFile(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.storage
      .from(getAircraftManualsBucket())
      .download(storagePath)
    if (error) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

export async function deleteAircraftManualFile(
  storagePath: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.storage
      .from(getAircraftManualsBucket())
      .remove([storagePath])
    return !error
  } catch {
    return false
  }
}
