import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  canManageAllDepartmentForms,
  canViewDepartmentFormRow,
  effectiveDepartmanForDepartmentForms,
  normalizeDeptLabel,
} from "@/lib/department-form-access"
import { getOrganizationDepartmentOptions, isOrganizationDepartment } from "@/lib/organization-departments"
import {
  isAllowedDepartmentFormFile,
  lowerExtension,
  resolveDocumentMimeForUpload,
} from "@/lib/allowed-document-uploads"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"
import { deletePdfFromStorage, uploadPdfToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

const formSelect = {
  id: true,
  formNumber: true,
  title: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  department: true,
  revision: true,
  seriesId: true,
  isCurrent: true,
  createdBy: true,
  fileStoragePath: true,
  creator: {
    select: {
      isim: true,
      soyisim: true,
      email: true,
    },
  },
} as const

function mapFormRowToClient(
  r: {
    fileStoragePath: string | null
    formNumber: string
    id: number
    title: string
    slug: string
    createdAt: Date
    updatedAt: Date
    department: string
    revision: number
    seriesId: string
    isCurrent: boolean
    createdBy: number | null
    creator: {
      isim: string | null
      soyisim: string | null
      email: string
    } | null
  }
) {
  const { fileStoragePath, ...rest } = r
  return {
    ...rest,
    hasOriginalFile: Boolean(fileStoragePath?.trim()),
  }
}

export async function GET() {
  try {
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
    const departman = effectiveDepartmanForDepartmentForms(
      calisan?.departman,
      session.user.departman
    )
    const manageAll = canManageAllDepartmentForms(departman)

    const currentWhere = manageAll
      ? { isCurrent: true }
      : {
          isCurrent: true,
          department: normalizeDeptLabel(departman) || "__none__",
        }

    const forms = await prisma.departmentForm.findMany({
      where: currentWhere,
      orderBy: [{ department: "asc" }, { title: "asc" }],
      select: formSelect,
    })

    const historicWhere = manageAll
      ? { isCurrent: false }
      : {
          isCurrent: false,
          department: normalizeDeptLabel(departman) || "__none__",
        }

    const historicForms = await prisma.departmentForm.findMany({
      where: historicWhere,
      orderBy: [{ seriesId: "asc" }, { revision: "desc" }],
      select: formSelect,
    })

    const mapList = (rows: typeof forms) =>
      rows.map((row) => mapFormRowToClient(row))

    return NextResponse.json({
      forms:
        manageAll || normalizeDeptLabel(departman) ? mapList(forms) : [],
      historicForms:
        manageAll || normalizeDeptLabel(departman)
          ? mapList(historicForms)
          : [],
      canManageAllDepartmentForms: manageAll,
      viewerDepartman: departman,
      departmentOptions: getOrganizationDepartmentOptions(),
    })
  } catch (e) {
    console.error("[department-forms] GET:", e)
    return NextResponse.json(
      {
        error:
          "Form listesi alınamadı. Oturumu yenileyin veya veritabanı şemasının güncel olduğundan emin olun.",
      },
      { status: 500 }
    )
  }
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

  const departman = effectiveDepartmanForDepartmentForms(
    calisan.departman,
    session.user.departman
  )
  const manageAll = canManageAllDepartmentForms(departman)

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart/form-data bekleniyor (title + department + file)." },
      { status: 400 }
    )
  }

  const form = await req.formData()
  const titleRaw = form.get("title")
  const title =
    typeof titleRaw === "string" ? titleRaw.trim().slice(0, 300) : ""
  const deptRaw = form.get("department")
  const department =
    typeof deptRaw === "string" ? deptRaw.trim() : ""
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
  const formNumberRaw = form.get("formNumber")
  const formNumberInput =
    typeof formNumberRaw === "string" ? formNumberRaw.trim().slice(0, 80) : ""

  const isRevisionPost =
    Number.isFinite(supersedesId) && !Number.isNaN(supersedesId) && supersedesId > 0

  if (!isRevisionPost && !formNumberInput) {
    return NextResponse.json(
      { error: "Form numarası gerekli (yeni form serisi)." },
      { status: 400 }
    )
  }

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 })
  }
  if (!isOrganizationDepartment(department)) {
    return NextResponse.json({ error: "Geçerli bir departman seçin." }, { status: 400 })
  }
  if (!manageAll) {
    if (!normalizeDeptLabel(departman)) {
      return NextResponse.json(
        { error: "Departman atanmamış hesaplar form yükleyemez." },
        { status: 403 }
      )
    }
    if (normalizeDeptLabel(departman) !== normalizeDeptLabel(department)) {
      return NextResponse.json(
        { error: "Yalnızca kendi departmanınızın formlarını yükleyebilirsiniz." },
        { status: 403 }
      )
    }
  }
  if (!Number.isFinite(revisionNum) || revisionNum < 0 || revisionNum > 999999) {
    return NextResponse.json(
      { error: "Revizyon numarası 0–999999 arasında tam sayı olmalıdır." },
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

  if (!isAllowedDepartmentFormFile(file)) {
    return NextResponse.json(
      {
        error:
          "Departman formları için yalnızca PDF, Word (.doc, .docx) veya Excel (.xls, .xlsx) kabul edilir.",
      },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let contentText: string
  let textExtractionFallback = false
  try {
    const extracted = await extractPlainTextFromUploadedDocument(buf, file.name)
    contentText = extracted.text
  } catch (e) {
    console.error("[department-forms] extract:", e)
    contentText = ""
    textExtractionFallback = true
  }

  if (!contentText.trim()) {
    textExtractionFallback = true
    contentText = [
      "[Metin otomatik çıkarılamadı — form dosyası ve kayıt yine de saklanır.]",
      `Başlık: ${title.trim()}`,
      formNumberInput ? `Form no: ${formNumberInput}` : "",
      `Kaynak dosya: ${file.name}`,
    ]
      .filter((line) => line.length > 0)
      .join("\n")
  }

  const baseSlug = slugifyManualTitle(`${department}-${title}`)
  let slug = baseSlug
  let n = 0
  while (await prisma.departmentForm.findUnique({ where: { slug } })) {
    n += 1
    slug = `${baseSlug}-${n}`.slice(0, 160)
  }

  const isRevision = isRevisionPost

  const origName = file.name.trim().slice(0, 280) || "document"
  const mime = resolveDocumentMimeForUpload(file)
  const ext = lowerExtension(file.name) || ""
  const storageLeaf = `rev${revisionNum}-${randomUUID().slice(0, 10)}${ext || ".bin"}`

  let seriesIdForUpload: string

  let formNumberResolved = formNumberInput

  if (isRevision) {
    const priorCheck = await prisma.departmentForm.findFirst({
      where: { id: supersedesId, isCurrent: true },
      select: { id: true, seriesId: true, department: true, formNumber: true },
    })
    if (!priorCheck) {
      return NextResponse.json(
        {
          error:
            "Yeni revizyon için seçilen form bulunamadı, güncel değil veya erişiminiz yok.",
        },
        { status: 400 }
      )
    }
    if (!canViewDepartmentFormRow(departman, priorCheck.department)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const clash = await prisma.departmentForm.findFirst({
      where: { seriesId: priorCheck.seriesId, revision: revisionNum },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json(
        {
          error:
            "Bu seri için aynı revizyon numarası zaten kullanılmış. Farklı bir numara girin.",
        },
        { status: 400 }
      )
    }
    seriesIdForUpload = priorCheck.seriesId
    if (!formNumberResolved) {
      formNumberResolved = (priorCheck.formNumber ?? "").trim().slice(0, 80)
    }
  } else {
    seriesIdForUpload = randomUUID()
  }

  const uploadRes = await uploadPdfToStorage(file, `department-forms/${seriesIdForUpload}`, {
    storageFileName: storageLeaf,
  })
  if (!uploadRes.ok) {
    return NextResponse.json(
      {
        error:
          uploadRes.message ||
          "Dosya depoya yüklenemedi. Supabase bucket ve ortam değişkenlerini kontrol edin.",
      },
      { status: 500 }
    )
  }

  const fileFields = {
    fileStoragePath: uploadRes.path,
    originalFileName: origName,
    fileMimeType: mime,
  }

  const createdSelect = {
    id: true,
    formNumber: true,
    title: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    department: true,
    revision: true,
    seriesId: true,
    isCurrent: true,
    fileStoragePath: true,
  } as const

  const toClientJson = (
    row: { fileStoragePath: string | null },
    opts?: { textExtractionFallback?: boolean }
  ) => {
    const { fileStoragePath: path, ...rest } = row
    return {
      ...rest,
      hasOriginalFile: Boolean(path?.trim()),
      ...(opts?.textExtractionFallback ? { textExtractionFallback: true as const } : {}),
    }
  }

  try {
    if (isRevision) {
      let duplicateRevision = false
      const created = await prisma.$transaction(async (tx) => {
        const prior = await tx.departmentForm.findFirst({
          where: { id: supersedesId, isCurrent: true },
          select: { id: true, seriesId: true, department: true },
        })
        if (!prior || prior.seriesId !== seriesIdForUpload) return null
        const clashInTx = await tx.departmentForm.findFirst({
          where: { seriesId: prior.seriesId, revision: revisionNum },
          select: { id: true },
        })
        if (clashInTx) {
          duplicateRevision = true
          return null
        }
        await tx.departmentForm.updateMany({
          where: { seriesId: prior.seriesId, isCurrent: true },
          data: { isCurrent: false },
        })
        return tx.departmentForm.create({
          data: {
            formNumber: formNumberResolved,
            title,
            slug,
            contentText,
            createdBy: calisan.id,
            department: prior.department,
            seriesId: prior.seriesId,
            revision: revisionNum,
            isCurrent: true,
            ...fileFields,
          },
          select: createdSelect,
        })
      })
      if (duplicateRevision) {
        await deletePdfFromStorage(uploadRes.path)
        return NextResponse.json(
          {
            error:
              "Bu seri için aynı revizyon numarası zaten kullanılmış. Farklı bir numara girin.",
          },
          { status: 400 }
        )
      }
      if (!created) {
        await deletePdfFromStorage(uploadRes.path)
        return NextResponse.json(
          {
            error:
              "Yeni revizyon için seçilen form bulunamadı, güncel değil veya erişiminiz yok.",
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        toClientJson(created, { textExtractionFallback })
      )
    }

    const row = await prisma.departmentForm.create({
      data: {
        formNumber: formNumberResolved,
        title,
        slug,
        contentText,
        createdBy: calisan.id,
        department,
        seriesId: seriesIdForUpload,
        revision: revisionNum,
        isCurrent: true,
        ...fileFields,
      },
      select: createdSelect,
    })
    return NextResponse.json(toClientJson(row, { textExtractionFallback }))
  } catch (e) {
    await deletePdfFromStorage(uploadRes.path)
    console.error("[department-forms] POST create:", e)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
