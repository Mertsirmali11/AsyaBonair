import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  assertCanManageCompanyManuals,
  effectiveEmployeeDepartman,
} from "@/lib/announcements-access"
import {
  getOrganizationDepartmentOptions,
  isOrganizationDepartment,
  isValidCustomManualDepartment,
} from "@/lib/organization-departments"
import {
  isAllowedCorrespondenceDocumentFile,
  lowerExtension,
} from "@/lib/allowed-document-uploads"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { isAdminDepartment } from "@/lib/department-access"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"
import {
  deleteCompanyManualFile,
  uploadCompanyManualFile,
} from "@/lib/company-manuals-storage"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

const manualSelect = {
  id: true,
  title: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  department: true,
  manualNumber: true,
  revisionDate: true,
  revision: true,
  seriesId: true,
  isCurrent: true,
  createdBy: true,
  fileName: true,
  fileStoragePath: true,
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
    const departman = effectiveEmployeeDepartman(
      calisan?.departman,
      session.user.departman
    )

    const manuals = await prisma.companyManual.findMany({
      where: { isCurrent: true },
      orderBy: { title: "asc" },
      select: manualSelect,
    })

    const seriesIds = [...new Set(manuals.map((m) => m.seriesId))]
    const historicInSeries =
      seriesIds.length === 0
        ? []
        : await prisma.companyManual.findMany({
            where: { isCurrent: false, seriesId: { in: seriesIds } },
            orderBy: [{ seriesId: "asc" }, { revision: "desc" }],
            select: manualSelect,
          })

    const previousBySeries = new Map<string, typeof historicInSeries>()
    for (const row of historicInSeries) {
      const list = previousBySeries.get(row.seriesId) ?? []
      list.push(row)
      previousBySeries.set(row.seriesId, list)
    }

    const canManageManuals =
      !!calisan && isAdminDepartment(departman)
    const departmentOptions = getOrganizationDepartmentOptions()

    return NextResponse.json({
      manuals: manuals.map((m) => {
        const { fileStoragePath, fileName, ...rest } = m
        const prevRows = previousBySeries.get(m.seriesId) ?? []
        return {
          ...rest,
          revisionDate: rest.revisionDate
            ? rest.revisionDate.toISOString().slice(0, 10)
            : null,
          documentPreview: documentPreviewKind(fileStoragePath, fileName),
          previousRevisions: prevRows.map((p) => {
            const { fileStoragePath: fp, fileName: fn, ...pr } = p
            return {
              ...pr,
              revisionDate: pr.revisionDate
                ? pr.revisionDate.toISOString().slice(0, 10)
                : null,
              documentPreview: documentPreviewKind(fp, fn),
            }
          }),
        }
      }),
      canManageManuals,
      departmentOptions,
    })
  } catch (e) {
    console.error("[GET /api/manuals]", e)
    const msg =
      e instanceof Error ? e.message : "Manuel listesi yüklenemedi."
    const hint =
      process.env.NODE_ENV === "development" &&
      typeof msg === "string" &&
      (msg.includes("manualNumber") || msg.includes("Unknown field"))
        ? " Şemayı güncellediyseniz: `pnpm exec prisma generate` ve `pnpm dev` yeniden başlatın."
        : ""
    return NextResponse.json(
      { error: `${msg}${hint}` },
      { status: 500 }
    )
  }
}

const createdManualSelect = {
  id: true,
  title: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  department: true,
  manualNumber: true,
  revisionDate: true,
  revision: true,
  seriesId: true,
  isCurrent: true,
} as const

function parseOptionalRevisionDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  const gate = await assertCanManageCompanyManuals()
  if (!gate.ok) return gate.response

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const postEmail = (session.user.email ?? "").trim()
  const calisan = postEmail
    ? await prisma.calisan.findFirst({
        where: { email: { equals: postEmail, mode: "insensitive" } },
        select: { id: true },
      })
    : null
  if (!calisan) {
    return NextResponse.json({ error: "Employee not found" }, { status: 403 })
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error:
          "multipart/form-data bekleniyor (başlık + departman + dosya).",
      },
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
  const deptModeRaw = form.get("departmentMode")
  const departmentMode =
    typeof deptModeRaw === "string" && deptModeRaw.trim().toLowerCase() === "custom"
      ? "custom"
      : "list"
  const revRaw = form.get("revision")
  const revisionNum =
    typeof revRaw === "string" && revRaw.trim()
      ? Number.parseInt(revRaw.trim(), 10)
      : Number.NaN
  const file = form.get("file")
  const manualNoRaw = form.get("manualNumber")
  const manualNumberInput =
    typeof manualNoRaw === "string" ? manualNoRaw.trim().slice(0, 120) : ""
  const revisionDateParsed = parseOptionalRevisionDate(form.get("revisionDate"))

  const supersedesRaw = form.get("supersedesId")
  const supersedesId =
    typeof supersedesRaw === "string" && supersedesRaw.trim()
      ? Number.parseInt(supersedesRaw.trim(), 10)
      : Number.NaN

  const isRevision =
    Number.isFinite(supersedesId) && !Number.isNaN(supersedesId) && supersedesId > 0

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 })
  }
  if (departmentMode === "custom") {
    if (!isValidCustomManualDepartment(department)) {
      return NextResponse.json(
        {
          error:
            "Özel departman 1–100 karakter olmalı; boş veya geçersiz karakter kullanılamaz.",
        },
        { status: 400 }
      )
    }
  } else if (!isOrganizationDepartment(department)) {
    return NextResponse.json({ error: "Geçerli bir departman seçin." }, { status: 400 })
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

  let seriesIdForUpload: string
  let priorCurrent: { seriesId: string; manualNumber: string | null } | null = null
  if (isRevision) {
    const prior = await prisma.companyManual.findFirst({
      where: { id: supersedesId, isCurrent: true },
      select: { seriesId: true, manualNumber: true },
    })
    if (!prior) {
      return NextResponse.json(
        { error: "Yeni revizyon için seçilen manuel bulunamadı veya güncel değil." },
        { status: 400 }
      )
    }
    priorCurrent = prior
    const clash = await prisma.companyManual.findFirst({
      where: { seriesId: prior.seriesId, revision: revisionNum },
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
    seriesIdForUpload = prior.seriesId
  } else {
    seriesIdForUpload = randomUUID()
  }

  const manualNumberResolved =
    isRevision && !manualNumberInput
      ? priorCurrent?.manualNumber ?? null
      : manualNumberInput || null

  const uploaded = await uploadCompanyManualFile(
    buf,
    seriesIdForUpload,
    slug,
    revisionNum,
    file
  )
  if (!uploaded.ok) {
    return NextResponse.json(
      {
        error: `Dosya depoya yüklenemedi: ${uploaded.message}`,
      },
      { status: 500 }
    )
  }

  try {
    if (isRevision) {
      let duplicateRevision = false
      const created = await prisma.$transaction(async (tx) => {
        const prior = await tx.companyManual.findFirst({
          where: { id: supersedesId, isCurrent: true },
          select: { id: true, seriesId: true },
        })
        if (!prior) return null
        const clash = await tx.companyManual.findFirst({
          where: { seriesId: prior.seriesId, revision: revisionNum },
          select: { id: true },
        })
        if (clash) {
          duplicateRevision = true
          return null
        }
        await tx.companyManual.updateMany({
          where: { seriesId: prior.seriesId, isCurrent: true },
          data: { isCurrent: false },
        })
        return tx.companyManual.create({
          data: {
            title,
            slug,
            contentText,
            fileStoragePath: uploaded.storagePath,
            fileName: uploaded.fileName,
            createdBy: calisan.id,
            department,
            manualNumber: manualNumberResolved,
            revisionDate: revisionDateParsed,
            seriesId: prior.seriesId,
            revision: revisionNum,
            isCurrent: true,
          },
          select: createdManualSelect,
        })
      })
      if (duplicateRevision) {
        await deleteCompanyManualFile(uploaded.storagePath)
        return NextResponse.json(
          {
            error:
              "Bu seri için aynı revizyon numarası zaten kullanılmış. Farklı bir numara girin.",
          },
          { status: 400 }
        )
      }
      if (!created) {
        await deleteCompanyManualFile(uploaded.storagePath)
        return NextResponse.json(
          { error: "Yeni revizyon için seçilen manuel bulunamadı veya güncel değil." },
          { status: 400 }
        )
      }
      return NextResponse.json(created)
    }

    const manual = await prisma.companyManual.create({
      data: {
        title,
        slug,
        contentText,
        fileStoragePath: uploaded.storagePath,
        fileName: uploaded.fileName,
        createdBy: calisan.id,
        department,
        manualNumber: manualNumberResolved,
        revisionDate: revisionDateParsed,
        seriesId: seriesIdForUpload,
        revision: revisionNum,
        isCurrent: true,
      },
      select: createdManualSelect,
    })

    return NextResponse.json(manual)
  } catch (e) {
    console.error("[manuals] create after upload:", e)
    await deleteCompanyManualFile(uploaded.storagePath)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
