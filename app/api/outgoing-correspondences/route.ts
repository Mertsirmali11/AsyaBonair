import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  ALLOWED_DOCUMENTS_ERROR_EN,
  isAllowedCorrespondenceDocumentFile,
} from "@/lib/allowed-document-uploads"
import {
  assignUniquePdfStorageNames,
  OUTGOING_PDF_MAX_TOTAL_BYTES,
  type OutgoingStoredAttachment,
} from "@/lib/outgoing-correspondence-attachments"
import { setOutgoingPdfAttachmentsJsonb } from "@/lib/persist-correspondence-pdf-jsonb"
import { deletePdfFromStorage, uploadPdfToStorage } from "@/lib/supabase-storage"
import { matchDepartmentKeyFromPaperNo } from "@/lib/outgoing-correspondence-departments"
import {
  allocateOutgoingPaperNo,
  releaseOutgoingPaperSlot,
} from "@/lib/outgoing-correspondence-numbering-server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [correspondences, deptConfigs] = await Promise.all([
      prisma.outgoingCorrespondence.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          creator: {
            select: {
              id: true,
              isim: true,
              soyisim: true,
              email: true,
              departman: true,
            },
          },
        },
      }),
      prisma.outgoingCorrespondenceDeptConfig.findMany({
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { key: true, label: true, paperPrefix: true },
      }),
    ])

    const enriched = correspondences.map((c) => {
      const inferred =
        c.departmentKey ?? matchDepartmentKeyFromPaperNo(c.paperNo, deptConfigs)
      const departmentLabel =
        deptConfigs.find((x) => x.key === inferred)?.label ?? null
      return { ...c, departmentLabel }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching outgoing correspondences:", error)
    return NextResponse.json(
      { error: "Could not fetch outgoing correspondences" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()

    const to = formData.get("to") as string
    const subject = formData.get("subject") as string
    const dateStr = formData.get("date") as string
    const content = formData.get("content") as string
    const createdBy = formData.get("createdBy") as string
    const departmentKeyRaw = String(formData.get("departmentKey") ?? "").trim()
    const pdfFiles = formData
      .getAll("pdf")
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (!to || !subject || !dateStr) {
      return NextResponse.json(
        { error: "To, Subject, and Date are required" },
        { status: 400 }
      )
    }

    const deptConfig = await prisma.outgoingCorrespondenceDeptConfig.findFirst({
      where: { key: departmentKeyRaw, isActive: true },
    })
    if (!deptConfig) {
      return NextResponse.json(
        {
          error:
            "Unknown or inactive department. Add or enable it under Configurations → Correspondences.",
        },
        { status: 400 }
      )
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    if (pdfFiles.length > 0) {
      const totalBytes = pdfFiles.reduce((s, f) => s + f.size, 0)
      if (totalBytes > OUTGOING_PDF_MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total attachment size must not exceed 50MB" },
          { status: 400 }
        )
      }
      for (const f of pdfFiles) {
        if (!isAllowedCorrespondenceDocumentFile(f)) {
          return NextResponse.json({ error: ALLOWED_DOCUMENTS_ERROR_EN }, { status: 400 })
        }
      }
    }

    let paperNo: string
    try {
      paperNo = await prisma.$transaction(
        async (tx) =>
          allocateOutgoingPaperNo(tx, departmentKeyRaw, {
            paperPrefix: deptConfig.paperPrefix,
            includeYearInPaperNo: deptConfig.includeYearInPaperNo,
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 15_000,
        }
      )
    } catch (e) {
      console.error("allocateOutgoingPaperNo:", e)
      return NextResponse.json(
        { error: "Could not assign correspondence number" },
        { status: 500 }
      )
    }

    const releaseAllocatedNumber = async () => {
      await releaseOutgoingPaperSlot(prisma, {
        departmentKey: departmentKeyRaw,
        paperNo,
        paperPrefix: deptConfig.paperPrefix,
      })
    }

    let pdfPath: string | null = null
    let pdfFileName: string | null = null
    let pdfAttachments: OutgoingStoredAttachment[] | null = null

    if (pdfFiles.length > 0) {
      const storageNames = assignUniquePdfStorageNames(pdfFiles)
      const uploaded: OutgoingStoredAttachment[] = []
      const folderPrefix = `outgoing/${paperNo}`

      try {
        for (let i = 0; i < pdfFiles.length; i++) {
          const uploadResult = await uploadPdfToStorage(pdfFiles[i], folderPrefix, {
            storageFileName: storageNames[i],
          })
          if (!uploadResult.ok) {
            for (const a of uploaded) {
              await deletePdfFromStorage(a.path)
            }
            await releaseAllocatedNumber()
            return NextResponse.json(
              {
                error: `Dosya yüklenemedi (${pdfFiles[i].name}): ${uploadResult.message}`,
              },
              { status: 500 }
            )
          }
          uploaded.push({ path: uploadResult.path, fileName: uploadResult.fileName })
        }
      } catch (fileError: unknown) {
        console.error("File upload error:", fileError)
        await releaseAllocatedNumber()
        const msg = fileError instanceof Error ? fileError.message : "Unknown error"
        return NextResponse.json(
          { error: `File upload failed: ${msg}` },
          { status: 500 }
        )
      }

      pdfAttachments = uploaded
      pdfPath = uploaded[0]?.path ?? null
      pdfFileName = uploaded[0]?.fileName ?? null
    }

    let correspondence
    try {
      correspondence = await prisma.outgoingCorrespondence.create({
        data: {
          paperNo: paperNo,
          departmentKey: departmentKeyRaw,
          to: to,
          subject: subject,
          date: date,
          content: content || null,
          pdfPath: pdfPath,
          pdfFileName: pdfFileName,
          createdBy: createdBy ? parseInt(createdBy) : null,
        },
        include: {
          creator: {
            select: {
              id: true,
              isim: true,
              soyisim: true,
              email: true,
              departman: true,
            },
          },
        },
      })
    } catch (createErr: unknown) {
      await releaseAllocatedNumber()
      throw createErr
    }

    if (pdfAttachments?.length) {
      try {
        await setOutgoingPdfAttachmentsJsonb(correspondence.id, pdfAttachments)
      } catch (jsonbErr) {
        console.error("setOutgoingPdfAttachmentsJsonb:", jsonbErr)
        await prisma.outgoingCorrespondence.delete({ where: { id: correspondence.id } })
        await releaseAllocatedNumber()
        return NextResponse.json(
          { error: "Could not save attachment metadata" },
          { status: 500 }
        )
      }
    }

    const full = await prisma.outgoingCorrespondence.findUnique({
      where: { id: correspondence.id },
      include: {
        creator: {
          select: {
            id: true,
            isim: true,
            soyisim: true,
            email: true,
            departman: true,
          },
        },
      },
    })

    const deptConfigs = await prisma.outgoingCorrespondenceDeptConfig.findMany({
      select: { key: true, label: true, paperPrefix: true },
    })
    const inferred =
      full?.departmentKey ??
      matchDepartmentKeyFromPaperNo(full?.paperNo ?? null, deptConfigs)
    const departmentLabel =
      deptConfigs.find((x) => x.key === inferred)?.label ?? null

    return NextResponse.json(
      { ...(full ?? correspondence), departmentLabel },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Error creating outgoing correspondence:", error)
    const err = error as { message?: string; code?: string; name?: string; stack?: string }
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    })

    if (err.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid creator ID" },
        { status: 400 }
      )
    }

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Paper number already exists" },
        { status: 400 }
      )
    }

    let errorMessage =
      process.env.NODE_ENV === "development"
        ? err.message || "Could not create outgoing correspondence"
        : "Could not create outgoing correspondence"

    if (
      typeof err.message === "string" &&
      err.message.includes("Unknown argument `pdfAttachments`")
    ) {
      errorMessage =
        "Veritabanı istemcisi güncel değil. Projede `pnpm exec prisma generate` çalıştırıp geliştirme sunucusunu yeniden başlatın (pnpm dev)."
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
