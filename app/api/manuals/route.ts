import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"
import { isAllowedCorrespondenceDocumentFile } from "@/lib/allowed-document-uploads"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const manuals = await prisma.companyManual.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      slug: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ manuals })
}

export async function POST(req: NextRequest) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!calisan) {
    return NextResponse.json({ error: "Employee not found" }, { status: 403 })
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart/form-data bekleniyor (title + file)." },
      { status: 400 }
    )
  }

  const form = await req.formData()
  const titleRaw = form.get("title")
  const title =
    typeof titleRaw === "string" ? titleRaw.trim().slice(0, 300) : ""
  const file = form.get("file")

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 })
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Dosya çok büyük (en fazla ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    )
  }

  if (!isAllowedCorrespondenceDocumentFile(file)) {
    return NextResponse.json(
      { error: "Yalnızca PDF, Word, Excel veya PowerPoint kabul edilir." },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let contentText: string
  try {
    const extracted = await extractPlainTextFromUploadedDocument(buf, file.name)
    contentText = extracted.text
  } catch (e) {
    console.error("[manuals] extract:", e)
    return NextResponse.json(
      {
        error:
          "Dosya metne çevrilemedi. .docx / .xlsx / .pptx veya PDF deneyin; eski .doc için dosyayı PDF veya .docx olarak kaydedin.",
      },
      { status: 400 }
    )
  }

  if (!contentText.trim()) {
    return NextResponse.json(
      {
        error:
          "Dosyada metin bulunamadı (taranmış PDF veya boş dosya olabilir).",
      },
      { status: 400 }
    )
  }

  const baseSlug = slugifyManualTitle(title)
  let slug = baseSlug
  let n = 0
  while (await prisma.companyManual.findUnique({ where: { slug } })) {
    n += 1
    slug = `${baseSlug}-${n}`.slice(0, 160)
  }

  const manual = await prisma.companyManual.create({
    data: {
      title,
      slug,
      contentText,
      createdBy: calisan.id,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(manual)
}
