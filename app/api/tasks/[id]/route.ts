import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const status = formData.get("status") as string | null

    let filePath: string | undefined
    let fileName: string | undefined

    if (file) {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const bytes = await file.arrayBuffer()
      const safeName = `${Date.now()}_${file.name}`
      const storagePath = `tasks/${id}/${safeName}`

      const { error } = await supabase.storage
        .from("Aircraft-Manuals")
        .upload(storagePath, bytes, { contentType: file.type })

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("Aircraft-Manuals")
          .getPublicUrl(storagePath)
        filePath = urlData.publicUrl
        fileName = file.name
      }
    }

    const task = await prisma.meetingTask.update({
      where: { id: parseInt(id) },
      data: {
        ...(status && { status }),
        ...(filePath && { filePath }),
        ...(fileName && { fileName }),
      },
      include: { assignee: { select: { isim: true, soyisim: true } } },
    })
    return NextResponse.json(task)
  }

  const body = await req.json()
  const task = await prisma.meetingTask.update({
    where: { id: parseInt(id) },
    data: body,
    include: { assignee: { select: { isim: true, soyisim: true } } },
  })
  return NextResponse.json(task)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.meetingTask.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}