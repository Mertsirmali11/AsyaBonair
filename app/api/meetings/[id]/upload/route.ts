import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { createClient } from "@supabase/supabase-js"

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-À-ſ]/g, "_").slice(0, 200)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get("file") as File

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const cleanName = sanitizeFileName(file.name)
  const safeName = `${Date.now()}_${cleanName}`
  const storagePath = `meetings/${id}/${safeName}`
  const supabase = getSupabase()

  const { error } = await supabase.storage
    .from("Aircraft-Manuals")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = supabase.storage
    .from("Aircraft-Manuals")
    .getPublicUrl(storagePath)

  await prisma.meeting.update({
    where: { id: parseInt(id) },
    data: {
      filePath: urlData.publicUrl,
      fileName: cleanName,
    },
  })

  return NextResponse.json({ filePath: urlData.publicUrl, fileName: file.name })
}