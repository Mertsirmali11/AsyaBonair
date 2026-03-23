import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { supabase } from "@/lib/supabase-storage"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData()
  const file = formData.get("file") as File

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const safeName = `${Date.now()}_${file.name}`
  const storagePath = `meetings/${params.id}/${safeName}`

  const { error } = await supabase.storage
    .from("Aircraft-Manuals")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = supabase.storage
    .from("Aircraft-Manuals")
    .getPublicUrl(storagePath)

  await prisma.meeting.update({
    where: { id: parseInt(params.id) },
    data: {
      filePath: urlData.publicUrl,
      fileName: file.name,
    },
  })

  return NextResponse.json({ filePath: urlData.publicUrl, fileName: file.name })
}
