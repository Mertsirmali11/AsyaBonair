import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get("file") as File
  const bytes = await file.arrayBuffer()
  const safeName = `${Date.now()}_${file.name}`
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
      fileName: file.name,
    },
  })

  return NextResponse.json({ filePath: urlData.publicUrl, fileName: file.name })
}