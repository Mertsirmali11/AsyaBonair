import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const status = formData.get("status") as string | null

    let filePath: string | undefined
    let fileName: string | undefined

    if (file) {
      const { supabase } = await import("@/lib/supabase-storage")
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = `${Date.now()}_${file.name}`
      const storagePath = `tasks/${params.id}/${safeName}`

      const { error } = await supabase.storage
        .from("Aircraft-Manuals")
        .upload(storagePath, buffer, { contentType: file.type })

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("Aircraft-Manuals")
          .getPublicUrl(storagePath)
        filePath = urlData.publicUrl
        fileName = file.name
      }
    }

    const task = await prisma.meetingTask.update({
      where: { id: parseInt(params.id) },
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
    where: { id: parseInt(params.id) },
    data: body,
    include: { assignee: { select: { isim: true, soyisim: true } } },
  })
  return NextResponse.json(task)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.meetingTask.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
