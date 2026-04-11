import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { effectiveEmployeeDepartman } from "@/lib/announcements-access"
import { canEditDocumentProcedure } from "@/lib/document-procedure-access"
import { DOCUMENT_PROCEDURE_SERIES_ID } from "@/lib/document-procedure-constants"
import {
  isAllowedCorrespondenceDocumentFile,
  resolveDocumentMimeForUpload,
} from "@/lib/allowed-document-uploads"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"
import { uploadPdfToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

const creatorSelect = {
  select: {
    isim: true,
    soyisim: true,
    email: true,
  },
} as const

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = (session.user.email ?? "").trim()
  const calisan = email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { departman: true },
      })
    : null
  const departman = effectiveEmployeeDepartman(
    calisan?.departman,
    session.user.departman
  )
  const canEdit = canEditDocumentProcedure(departman)

  const current = await prisma.documentProcedureVersion.findFirst({
    where: { seriesId: DOCUMENT_PROCEDURE_SERIES_ID, isCurrent: true },
    select: {
      id: true,
      title: true,
      slug: true,
      revision: true,
      contentText: true,
      fileStoragePath: true,
      originalFileName: true,
      fileMimeType: true,
      createdAt: true,
      updatedAt: true,
      creator: creatorSelect,
    },
  })

  const historic = canEdit
    ? await prisma.documentProcedureVersion.findMany({
        where: { seriesId: DOCUMENT_PROCEDURE_SERIES_ID, isCurrent: false },
        orderBy: { revision: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          revision: true,
          seriesId: true,
          isCurrent: true,
          fileStoragePath: true,
          originalFileName: true,
          fileMimeType: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          creator: creatorSelect,
        },
      })
    : []

  return NextResponse.json({
    current: current
      ? {
          id: current.id,
          title: current.title,
          slug: current.slug,
          revision: current.revision,
          contentText: current.contentText,
          hasFile: Boolean(current.fileStoragePath?.trim()),
          originalFileName: current.originalFileName,
          fileMimeType: current.fileMimeType,
          createdAt: current.createdAt,
          updatedAt: current.updatedAt,
          creator: current.creator,
        }
      : null,
    historicVersions: historic.map((h) => ({
      id: h.id,
      title: h.title,
      slug: h.slug,
      revision: h.revision,
      seriesId: h.seriesId,
      isCurrent: h.isCurrent,
      hasFile: Boolean(h.fileStoragePath?.trim()),
      originalFileName: h.originalFileName,
      fileMimeType: h.fileMimeType,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      createdBy: h.createdBy,
      creator: h.creator,
    })),
    canEditDocumentProcedure: canEdit,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const postEmail = (session.user.email ?? "").trim()
  const calisan = postEmail
    ? await prisma.calisan.findFirst({
        where: { email: { equals: postEmail, mode: "insensitive" } },
        select: { id: true, departman: true },
      })
    : null
  if (!calisan) {
    return NextResponse.json({ error: "Employee not found" }, { status: 403 })
  }

  const departman = effectiveEmployeeDepartman(
    calisan.departman,
    session.user.departman
  )
  if (!canEditDocumentProcedure(departman)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart/form-data bekleniyor (title + file; isteğe bağlı revision alanları)." },
      { status: 400 }
    )
  }

  const form = await req.formData()
  const titleRaw = form.get("title")
  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim().slice(0, 300)
      : "Document Procedure"
  const revRaw = form.get("revision")
  const revisionNum =
    typeof revRaw === "string" && revRaw.trim()
      ? Number.parseInt(revRaw.trim(), 10)
      : Number.NaN
  const file = form.get("file")
  const supersedesRaw = form.get("supersedesId")
  const supersedesId =
    typeof supersedesRaw === "string" && supersedesRaw.trim()
      ? Number.parseInt(supersedesRaw.trim(), 10)
      : Number.NaN

  if (!Number.isFinite(revisionNum) || revisionNum < 1 || revisionNum > 999999) {
    return NextResponse.json(
      { error: "Revizyon numarası 1–999999 arasında tam sayı olmalıdır." },
      { status: 400 }
    )
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
    console.error("[document-procedure] extract:", e)
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

  const baseSlug = slugifyManualTitle(`document-procedure-${title}`)
  let slug = baseSlug
  let n = 0
  while (await prisma.documentProcedureVersion.findUnique({ where: { slug } })) {
    n += 1
    slug = `${baseSlug}-${n}`.slice(0, 160)
  }

  const existingCurrent = await prisma.documentProcedureVersion.findFirst({
    where: { seriesId: DOCUMENT_PROCEDURE_SERIES_ID, isCurrent: true },
    select: { id: true },
  })

  const isRevision =
    Number.isFinite(supersedesId) && !Number.isNaN(supersedesId) && supersedesId > 0

  if (existingCurrent && !isRevision) {
    return NextResponse.json(
      {
        error:
          "Belge zaten mevcut. Yeni sürüm için formda «Mevcut belgenin yeni revizyonu» seçip güncel satırı işaretleyin.",
      },
      { status: 400 }
    )
  }

  if (!existingCurrent && isRevision) {
    return NextResponse.json(
      { error: "İlk yükleme için «Yeni belge» akışını kullanın (henüz kayıt yok)." },
      { status: 400 }
    )
  }

  const folder = `document-procedure/${DOCUMENT_PROCEDURE_SERIES_ID}`
  const safeFile =
    file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, "_")
      .replace(/\s+/g, "_") || "document"
  const storageFileName = `${randomUUID()}_${safeFile}`.slice(0, 200)
  const uploaded = await uploadPdfToStorage(file, folder, {
    storageFileName,
    upsert: false,
  })
  if (!uploaded.ok) {
    return NextResponse.json(
      { error: uploaded.message || "Dosya depoya yüklenemedi." },
      { status: 400 }
    )
  }
  const fileMimeType = resolveDocumentMimeForUpload(file)
  const originalFileName = file.name.trim().slice(0, 280) || safeFile

  if (isRevision) {
    let duplicateRevision = false
    const created = await prisma.$transaction(async (tx) => {
      const prior = await tx.documentProcedureVersion.findFirst({
        where: {
          id: supersedesId,
          isCurrent: true,
          seriesId: DOCUMENT_PROCEDURE_SERIES_ID,
        },
        select: { id: true, seriesId: true },
      })
      if (!prior) return null
      const clash = await tx.documentProcedureVersion.findFirst({
        where: { seriesId: prior.seriesId, revision: revisionNum },
        select: { id: true },
      })
      if (clash) {
        duplicateRevision = true
        return null
      }
      await tx.documentProcedureVersion.updateMany({
        where: { seriesId: prior.seriesId, isCurrent: true },
        data: { isCurrent: false },
      })
      return tx.documentProcedureVersion.create({
        data: {
          title,
          slug,
          contentText,
          fileStoragePath: uploaded.path,
          originalFileName,
          fileMimeType,
          createdBy: calisan.id,
          seriesId: DOCUMENT_PROCEDURE_SERIES_ID,
          revision: revisionNum,
          isCurrent: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          revision: true,
          seriesId: true,
          isCurrent: true,
        },
      })
    })
    if (duplicateRevision) {
      return NextResponse.json(
        {
          error:
            "Bu seri için aynı revizyon numarası zaten kullanılmış. Farklı bir numara girin.",
        },
        { status: 400 }
      )
    }
    if (!created) {
      return NextResponse.json(
        { error: "Yeni revizyon için seçilen kayıt bulunamadı veya güncel değil." },
        { status: 400 }
      )
    }
    return NextResponse.json(created)
  }

  const row = await prisma.documentProcedureVersion.create({
    data: {
      title,
      slug,
      contentText,
      fileStoragePath: uploaded.path,
      originalFileName,
      fileMimeType,
      createdBy: calisan.id,
      seriesId: DOCUMENT_PROCEDURE_SERIES_ID,
      revision: revisionNum,
      isCurrent: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      revision: true,
      seriesId: true,
      isCurrent: true,
    },
  })

  return NextResponse.json(row)
}
