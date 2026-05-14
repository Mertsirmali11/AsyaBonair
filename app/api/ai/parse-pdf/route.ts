import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { isAllowedCorrespondenceDocumentFile } from "@/lib/allowed-document-uploads"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 })
  }

  // Rate limiting: kullanıcı başına dakikada 15 dosya yükleme
  const rl = rateLimit(`ai:parse-pdf:${session.user.email}`, 15, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla dosya yüklendi. Lütfen bir dakika bekleyin." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart/form-data bekleniyor (file)." },
      { status: 400 }
    )
  }

  const form = await req.formData()
  const file = form.get("file")

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

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const { text, truncated } = await extractPlainTextFromUploadedDocument(
      buf,
      file.name
    )
    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Dosyadan metin çıkarılamadı (boş, taranmış veya desteklenmeyen eski .doc olabilir).",
        },
        { status: 422 }
      )
    }
    return NextResponse.json({ text, truncated })
  } catch (e) {
    console.error("parse-pdf:", e)
    return NextResponse.json(
      { error: "Dosya okunamadı. PDF veya Office Open XML (.docx, .xlsx, .pptx) deneyin." },
      { status: 500 }
    )
  }
}
