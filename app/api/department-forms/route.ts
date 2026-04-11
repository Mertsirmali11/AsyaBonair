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
import { isAllowedDepartmentFormFile } from "@/lib/allowed-document-uploads"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { extractPlainTextFromUploadedDocument } from "@/lib/extract-uploaded-document-text"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

const formSelect = {
  id: true,
  title: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  department: true,
  revision: true,
  seriesId: true,
  isCurrent: true,
  createdBy: true,
  creator: {
    select: {
      isim: true,
      soyisim: true,
      email: true,
    },
  },
} as const

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

    return NextResponse.json({
      forms: manageAll || normalizeDeptLabel(departman) ? forms : [],
      historicForms:
        manageAll || normalizeDeptLabel(departman) ? historicForms : [],
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
  try {
    const extracted = await extractPlainTextFromUploadedDocument(buf, file.name)
    contentText = extracted.text
  } catch (e) {
    console.error("[department-forms] extract:", e)
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

  const baseSlug = slugifyManualTitle(`${department}-${title}`)
  let slug = baseSlug
  let n = 0
  while (await prisma.departmentForm.findUnique({ where: { slug } })) {
    n += 1
    slug = `${baseSlug}-${n}`.slice(0, 160)
  }

  const isRevision =
    Number.isFinite(supersedesId) && !Number.isNaN(supersedesId) && supersedesId > 0

  if (isRevision) {
    let duplicateRevision = false
    const created = await prisma.$transaction(async (tx) => {
      const prior = await tx.departmentForm.findFirst({
        where: { id: supersedesId, isCurrent: true },
        select: { id: true, seriesId: true, department: true },
      })
      if (!prior) return null
      if (!canViewDepartmentFormRow(departman, prior.department)) return null
      const clash = await tx.departmentForm.findFirst({
        where: { seriesId: prior.seriesId, revision: revisionNum },
        select: { id: true },
      })
      if (clash) {
        duplicateRevision = true
        return null
      }
      await tx.departmentForm.updateMany({
        where: { seriesId: prior.seriesId, isCurrent: true },
        data: { isCurrent: false },
      })
      return tx.departmentForm.create({
        data: {
          title,
          slug,
          contentText,
          createdBy: calisan.id,
          department: prior.department,
          seriesId: prior.seriesId,
          revision: revisionNum,
          isCurrent: true,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          department: true,
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
        { error: "Yeni revizyon için seçilen form bulunamadı, güncel değil veya erişiminiz yok." },
        { status: 400 }
      )
    }
    return NextResponse.json(created)
  }

  const row = await prisma.departmentForm.create({
    data: {
      title,
      slug,
      contentText,
      createdBy: calisan.id,
      department,
      seriesId: randomUUID(),
      revision: revisionNum,
      isCurrent: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      department: true,
      revision: true,
      seriesId: true,
      isCurrent: true,
    },
  })

  return NextResponse.json(row)
}
