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
import {
  fetchRegisteredDepartmentNames,
  isDepartmentInRegistry,
} from "@/lib/organization-departments"
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

const procedureSelect = {
  id: true,
  procedureNumber: true,
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
  originalFileName: true,
  creator: {
    select: {
      isim: true,
      soyisim: true,
      email: true,
    },
  },
} as const

function documentPreviewKind(
  fileStoragePath: string | null,
  fileName: string | null
): "pdf" | "none" | "unsupported" {
  if (!fileStoragePath) return "none"
  const ext = lowerExtension(fileName ?? "")
  if (ext === ".pdf") return "pdf"
  return "unsupported"
}

function mapProcedureRowToClient(
  r: {
    fileStoragePath: string | null
    originalFileName: string | null
    procedureNumber: string
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
    documentPreview: documentPreviewKind(fileStoragePath, r.originalFileName),
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

    const procedures = await prisma.departmentProcedure.findMany({
      where: currentWhere,
      orderBy: [{ department: "asc" }, { title: "asc" }],
      select: procedureSelect,
    })

    const historicWhere = manageAll
      ? { isCurrent: false }
      : {
          isCurrent: false,
          department: normalizeDeptLabel(departman) || "__none__",
        }

    const historicProcedures = await prisma.departmentProcedure.findMany({
      where: historicWhere,
      orderBy: [{ seriesId: "asc" }, { revision: "desc" }],
      select: procedureSelect,
    })

    const mapList = (rows: typeof procedures) =>
      rows.map((row) => mapProcedureRowToClient(row))

    const mapped =
      manageAll || normalizeDeptLabel(departman) ? mapList(procedures) : []
    const seriesIds = [...new Set(mapped.map((m) => m.seriesId))]
    const historicInSeries =
      seriesIds.length === 0
        ? []
        : await prisma.departmentProcedure.findMany({
            where: { isCurrent: false, seriesId: { in: seriesIds } },
            orderBy: [{ seriesId: "asc" }, { revision: "desc" }],
            select: procedureSelect,
          })

    const previousBySeries = new Map<string, typeof historicInSeries>()
    for (const row of historicInSeries) {
      const list = previousBySeries.get(row.seriesId) ?? []
      list.push(row)
      previousBySeries.set(row.seriesId, list)
    }

    const withHistory = mapped.map((m) => {
      const prevRows = previousBySeries.get(m.seriesId) ?? []
      return {
        ...m,
        previousRevisions: prevRows.map((p) => {
          const mappedP = mapProcedureRowToClient(p)
          return {
            ...mappedP,
            createdAt: mappedP.createdAt.toISOString(),
            updatedAt: mappedP.updatedAt.toISOString(),
          }
        }),
      }
    })

    const serialized = withHistory.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      procedures: serialized,
      historicProcedures: mapList(historicProcedures).map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
      })),
      canManageAllDepartmentProcedures: manageAll,
      viewerDepartman: departman,
      departmentOptions: await fetchRegisteredDepartmentNames(prisma),
    })
  } catch (e) {
    console.error("[department-procedures] GET:", e)
    return NextResponse.json(
      {
        error:
          "Prosedür listesi alınamadı. Oturumu yenileyin veya veritabanı şemasının güncel olduğundan emin olun.",
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

  const body = await req.formData()
  const titleRaw = body.get("title")
  const title =
    typeof titleRaw === "string" ? titleRaw.trim().slice(0, 300) : ""
  const deptRaw = body.get("department")
  const department =
    typeof deptRaw === "string" ? deptRaw.trim() : ""
  const revRaw = body.get("revision")
  const revisionNum =
    typeof revRaw === "string" && revRaw.trim()
      ? Number.parseInt(revRaw.trim(), 10)
      : Number.NaN
  const file = body.get("file")
  const supersedesRaw = body.get("supersedesId")
  const supersedesId =
    typeof supersedesRaw === "string" && supersedesRaw.trim()
      ? Number.parseInt(supersedesRaw.trim(), 10)
      : Number.NaN
  const procNumRaw = body.get("procedureNumber")
  const procedureNumberInput =
    typeof procNumRaw === "string" ? procNumRaw.trim().slice(0, 80) : ""

  const isRevisionPost =
    Number.isFinite(supersedesId) && !Number.isNaN(supersedesId) && supersedesId > 0

  if (!isRevisionPost && !procedureNumberInput) {
    return NextResponse.json(
      { error: "Prosedür numarası gerekli (yeni prosedür serisi)." },
      { status: 400 }
    )
  }

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 })
  }
  const deptRegistry = await fetchRegisteredDepartmentNames(prisma)
  if (!isDepartmentInRegistry(department, deptRegistry)) {
    return NextResponse.json(
      { error: "Geçerli bir departman seçin (Configurations → Departmanlar)." },
      { status: 400 }
    )
  }
  if (!manageAll) {
    return NextResponse.json(
      {
        error:
          "Yalnızca Admin departman prosedürü yükleyebilir veya revize edebilir.",
      },
      { status: 403 }
    )
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
          "Departman prosedürleri için yalnızca PDF, Word (.doc, .docx) veya Excel (.xls, .xlsx) kabul edilir.",
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
    console.error("[department-procedures] extract:", e)
    contentText = ""
    textExtractionFallback = true
  }

  if (!contentText.trim()) {
    textExtractionFallback = true
    contentText = [
      "[Metin otomatik çıkarılamadı — dosya ve kayıt yine de saklanır.]",
      `Başlık: ${title.trim()}`,
      procedureNumberInput ? `Prosedür no: ${procedureNumberInput}` : "",
      `Kaynak dosya: ${file.name}`,
    ]
      .filter((line) => line.length > 0)
      .join("\n")
  }

  const baseSlug = slugifyManualTitle(`${department}-${title}`)
  let slug = baseSlug
  let n = 0
  while (await prisma.departmentProcedure.findUnique({ where: { slug } })) {
    n += 1
    slug = `${baseSlug}-${n}`.slice(0, 160)
  }

  const isRevision = isRevisionPost

  const origName = file.name.trim().slice(0, 280) || "document"
  const mime = resolveDocumentMimeForUpload(file)
  const ext = lowerExtension(file.name) || ""
  const storageLeaf = `rev${revisionNum}-${randomUUID().slice(0, 10)}${ext || ".bin"}`

  let seriesIdForUpload: string

  let procedureNumberResolved = procedureNumberInput

  if (isRevision) {
    const priorCheck = await prisma.departmentProcedure.findFirst({
      where: { id: supersedesId, isCurrent: true },
      select: { id: true, seriesId: true, department: true, procedureNumber: true },
    })
    if (!priorCheck) {
      return NextResponse.json(
        {
          error:
            "Yeni revizyon için seçilen prosedür bulunamadı, güncel değil veya erişiminiz yok.",
        },
        { status: 400 }
      )
    }
    if (!canViewDepartmentFormRow(departman, priorCheck.department)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const clash = await prisma.departmentProcedure.findFirst({
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
    if (!procedureNumberResolved) {
      procedureNumberResolved = (priorCheck.procedureNumber ?? "").trim().slice(0, 80)
    }
  } else {
    seriesIdForUpload = randomUUID()
  }

  const uploadRes = await uploadPdfToStorage(file, `department-procedures/${seriesIdForUpload}`, {
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
    procedureNumber: true,
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
        const prior = await tx.departmentProcedure.findFirst({
          where: { id: supersedesId, isCurrent: true },
          select: { id: true, seriesId: true, department: true },
        })
        if (!prior || prior.seriesId !== seriesIdForUpload) return null
        const clashInTx = await tx.departmentProcedure.findFirst({
          where: { seriesId: prior.seriesId, revision: revisionNum },
          select: { id: true },
        })
        if (clashInTx) {
          duplicateRevision = true
          return null
        }
        await tx.departmentProcedure.updateMany({
          where: { seriesId: prior.seriesId, isCurrent: true },
          data: { isCurrent: false },
        })
        return tx.departmentProcedure.create({
          data: {
            procedureNumber: procedureNumberResolved,
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
              "Yeni revizyon için seçilen prosedür bulunamadı, güncel değil veya erişiminiz yok.",
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        toClientJson(created, { textExtractionFallback })
      )
    }

    const row = await prisma.departmentProcedure.create({
      data: {
        procedureNumber: procedureNumberResolved,
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
    console.error("[department-procedures] POST create:", e)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
