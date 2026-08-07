import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  type OutgoingStoredAttachment,
} from "@/lib/outgoing-correspondence-attachments"
import { setOutgoingPdfAttachmentsJsonb } from "@/lib/persist-correspondence-pdf-jsonb"
import { deletePdfFromStorage, moveInStorage } from "@/lib/supabase-storage"
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

    const body = (await request.json().catch(() => null)) as {
      to?: string
      subject?: string
      date?: string
      content?: string
      createdBy?: string
      attachments?: { path: string; fileName: string }[]
    } | null
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const to = String(body.to ?? "").trim()
    const subject = String(body.subject ?? "").trim()
    const dateStr = String(body.date ?? "").trim()
    const content = String(body.content ?? "")
    const createdBy = String(body.createdBy ?? "")
    // Bu ekler, tarayıcının /api/correspondence-uploads üzerinden doğrudan
    // Supabase'e önceden yüklediği "pending" dosyalara işaret eder.
    const pendingAttachments = Array.isArray(body.attachments)
      ? body.attachments.filter(
          (a): a is { path: string; fileName: string } =>
            !!a && typeof a.path === "string" && typeof a.fileName === "string"
        )
      : []

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

    if (pendingAttachments.length > 0) {
      const uploaded: OutgoingStoredAttachment[] = []
      const folderPrefix = `outgoing/${paperNo}`

      try {
        for (const att of pendingAttachments) {
          const target = `${folderPrefix}/${att.fileName}`
          const moveResult = await moveInStorage(att.path, target)
          if (!moveResult.ok) {
            for (const a of uploaded) {
              await deletePdfFromStorage(a.path)
            }
            await deleteCorrespondence()
            await releaseAllocatedNumber()
            return NextResponse.json(
              { error: `Dosya taşınamadı (${att.fileName}): ${moveResult.message}` },
              { status: 500 }
            )
          }
          uploaded.push({ path: target, fileName: att.fileName })
        }
      } catch (fileError: unknown) {
        console.error("File move error:", fileError)
        await deleteCorrespondence()
        await releaseAllocatedNumber()
        const msg = fileError instanceof Error ? fileError.message : "Unknown error"
        return NextResponse.json(
          { error: `File move failed: ${msg}` },
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
