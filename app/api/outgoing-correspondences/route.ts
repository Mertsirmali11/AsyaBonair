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
import {
  allocateOutgoingPaperNo,
  ensureOutgoingSingleStreamDept,
  isOutgoingNumberAllocationRetryable,
  outgoingCorrespondenceCreateErrorMessage,
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

    const correspondences = await prisma.outgoingCorrespondence.findMany({
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
    })

    return NextResponse.json(correspondences)
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
    const pdfFiles = formData
      .getAll("pdf")
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (!to || !subject || !dateStr) {
      return NextResponse.json(
        { error: "To, Subject, and Date are required" },
        { status: 400 }
      )
    }

    const streamDept = await ensureOutgoingSingleStreamDept(prisma)

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

    // Allocate the paper number and create the DB record atomically in one
    // Serializable transaction. This prevents two concurrent requests from
    // reading the same maxSeq and generating duplicate numbers, because
    // PostgreSQL SSI will abort one if they overlap on the same row range.
    // File uploads happen AFTER the record exists so the creation is safe.
    let correspondence!: Awaited<ReturnType<typeof prisma.outgoingCorrespondence.create>>
    const txOptions = {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 15_000,
    } as const

    const maxAllocAttempts = 4
    let allocated = false
    for (let attempt = 0; attempt < maxAllocAttempts; attempt++) {
      try {
        correspondence = await prisma.$transaction(
          async (tx) => {
            const paperNo = await allocateOutgoingPaperNo(tx, streamDept.departmentKey, {
              paperPrefix: streamDept.paperPrefix,
              includeYearInPaperNo: streamDept.includeYearInPaperNo,
            })
            return tx.outgoingCorrespondence.create({
              data: {
                paperNo,
                departmentKey: streamDept.departmentKey,
                to,
                subject,
                date,
                content: content || null,
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
          },
          txOptions
        )
        allocated = true
        break
      } catch (e) {
        if (
          isOutgoingNumberAllocationRetryable(e) &&
          attempt < maxAllocAttempts - 1
        ) {
          continue
        }
        console.error("allocateOutgoingPaperNo:", e)
        const uniqueMsg = outgoingCorrespondenceCreateErrorMessage(e)
        if (uniqueMsg) {
          return NextResponse.json({ error: uniqueMsg }, { status: 409 })
        }
        return NextResponse.json(
          { error: "Could not assign correspondence number" },
          { status: 500 }
        )
      }
    }

    if (!allocated) {
      return NextResponse.json(
        { error: "Could not assign correspondence number" },
        { status: 500 }
      )
    }

    const paperNo = correspondence.paperNo!

    const releaseAllocatedNumber = async () => {
      await releaseOutgoingPaperSlot(prisma, {
        departmentKey: streamDept.departmentKey,
        paperNo,
        paperPrefix: streamDept.paperPrefix,
      })
    }

    const deleteCorrespondence = async () => {
      await prisma.outgoingCorrespondence.delete({ where: { id: correspondence.id } })
    }

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
            await deleteCorrespondence()
            await releaseAllocatedNumber()
            return NextResponse.json(
              { error: `Dosya yüklenemedi (${pdfFiles[i].name}): ${uploadResult.message}` },
              { status: 500 }
            )
          }
          uploaded.push({ path: uploadResult.path, fileName: uploadResult.fileName })
        }
      } catch (fileError: unknown) {
        console.error("File upload error:", fileError)
        await deleteCorrespondence()
        await releaseAllocatedNumber()
        const msg = fileError instanceof Error ? fileError.message : "Unknown error"
        return NextResponse.json(
          { error: `File upload failed: ${msg}` },
          { status: 500 }
        )
      }

      const pdfPath = uploaded[0]?.path ?? null
      const pdfFileName = uploaded[0]?.fileName ?? null

      try {
        await prisma.outgoingCorrespondence.update({
          where: { id: correspondence.id },
          data: { pdfPath, pdfFileName },
        })
        await setOutgoingPdfAttachmentsJsonb(correspondence.id, uploaded)
      } catch (updateErr) {
        console.error("File metadata update error:", updateErr)
        for (const a of uploaded) {
          await deletePdfFromStorage(a.path)
        }
        await deleteCorrespondence()
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

    return NextResponse.json(full ?? correspondence, { status: 201 })
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

    const uniqueMsg = outgoingCorrespondenceCreateErrorMessage(error)
    if (uniqueMsg) {
      return NextResponse.json({ error: uniqueMsg }, { status: 409 })
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
