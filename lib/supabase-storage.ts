import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { createClient } from "@supabase/supabase-js"

const MAX_SIZE = 50 * 1024 * 1024

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const docs = await prisma.aircraftDocument.findMany({
    where: { aircraftId: parseInt(params.id) },
    include: { uploader: { select: { isim: true, soyisim: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData()
  const file = formData.get("file") as File
  const category = formData.get("category") as string
  const docType = formData.get("docType") as string
  const validFrom = formData.get("validFrom") as string | null
  const validUntil = formData.get("validUntil") as string | null
  const uploadedBy = formData.get("uploadedBy") as string | null

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 })
  }

  const aircraft = await prisma.ucaklar.findUnique({
    where: { id: parseInt(params.id) },
    select: { register: true },
  })

  const safeName = `${Date.now()}_${file.name}`
  const storagePath = `${aircraft?.register}/${category}s/${safeName}`

  const bytes = await file.arrayBuffer()
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

  const doc = await prisma.aircraftDocument.create({
    data: {
      aircraftId: parseInt(params.id),
      category,
      docType,
      fileName: file.name,
      filePath: urlData.publicUrl,
      fileSize: file.size,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      uploadedBy: uploadedBy ? parseInt(uploadedBy) : null,
      isArchived: false,
    },
    include: { uploader: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(doc)
}