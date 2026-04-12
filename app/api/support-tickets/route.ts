import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  isAllowedSupportAttachmentFile,
  resolveSupportAttachmentMime,
  sanitizeSupportAttachmentStorageBase,
  SUPPORT_ATTACHMENT_MAX_BYTES_PER_FILE,
  SUPPORT_ATTACHMENT_MAX_FILES,
} from "@/lib/support-attachment"
import { canManageSupportTicketsAsAdmin } from "@/lib/support-ticket-access"
import { deletePdfFromStorage, uploadBinaryToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

const attachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
} as const

const ticketSelect = {
  id: true,
  subject: true,
  content: true,
  status: true,
  adminAction: true,
  departmentSnapshot: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  lastUpdatedBy: true,
  attachments: { select: attachmentSelect, orderBy: { id: "asc" as const } },
  creator: {
    select: {
      id: true,
      isim: true,
      soyisim: true,
      email: true,
      departman: true,
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
          select: { id: true, departman: true },
        })
      : null
    if (!calisan) {
      return NextResponse.json({ error: "Employee not found" }, { status: 403 })
    }

    const isAdmin = canManageSupportTicketsAsAdmin(calisan.departman)

    const tickets = await prisma.supportTicket.findMany({
      where: isAdmin ? {} : { createdBy: calisan.id },
      orderBy: { createdAt: "desc" },
      select: ticketSelect,
    })

    return NextResponse.json({
      tickets,
      isAdmin,
    })
  } catch (e) {
    console.error("[support-tickets] GET:", e)
    return NextResponse.json(
      { error: "Destek talepleri yüklenemedi." },
      { status: 500 }
    )
  }
}

async function parseTicketBody(req: NextRequest): Promise<{
  subject: string
  content: string
  files: File[]
}> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData()
    const content = String(form.get("content") ?? "").trim()
    const subject = String(form.get("subject") ?? "").trim().slice(0, 200)
    const raw = form.getAll("files")
    const files: File[] = []
    for (const item of raw) {
      if (item instanceof File && item.size > 0) files.push(item)
    }
    return { subject, content, files }
  }

  const body = (await req.json().catch(() => null)) as {
    subject?: unknown
    content?: unknown
  } | null
  const content =
    typeof body?.content === "string" ? body.content.trim() : ""
  const subject =
    typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : ""
  return { subject, content, files: [] }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const email = (session.user.email ?? "").trim()
    const calisan = email
      ? await prisma.calisan.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, departman: true },
        })
      : null
    if (!calisan) {
      return NextResponse.json({ error: "Employee not found" }, { status: 403 })
    }

    const { subject, content, files } = await parseTicketBody(req)

    if (!content) {
      return NextResponse.json(
        { error: "Açıklama (içerik) gerekli." },
        { status: 400 }
      )
    }
    if (content.length > 16000) {
      return NextResponse.json(
        { error: "Açıklama en fazla 16000 karakter olabilir." },
        { status: 400 }
      )
    }

    if (files.length > SUPPORT_ATTACHMENT_MAX_FILES) {
      return NextResponse.json(
        {
          error: `En fazla ${SUPPORT_ATTACHMENT_MAX_FILES} dosya ekleyebilirsiniz.`,
        },
        { status: 400 }
      )
    }

    for (const f of files) {
      if (f.size > SUPPORT_ATTACHMENT_MAX_BYTES_PER_FILE) {
        return NextResponse.json(
          {
            error: `Dosya boyutu ${Math.floor(SUPPORT_ATTACHMENT_MAX_BYTES_PER_FILE / (1024 * 1024))} MB’ı aşamaz.`,
          },
          { status: 400 }
        )
      }
      if (!isAllowedSupportAttachmentFile(f)) {
        return NextResponse.json(
          {
            error:
              "Yalnızca PDF veya görsel (JPEG, PNG, WebP, GIF) yükleyebilirsiniz.",
          },
          { status: 400 }
        )
      }
    }

    const row = await prisma.supportTicket.create({
      data: {
        content,
        subject: subject || null,
        departmentSnapshot: (calisan.departman ?? "").trim() || null,
        createdBy: calisan.id,
      },
      select: { id: true },
    })

    const uploadedPaths: string[] = []
    try {
      const folderPrefix = `support-tickets/${row.id}`
      for (const file of files) {
        const mime = resolveSupportAttachmentMime(file)
        const storageFileName = `${randomUUID()}_${sanitizeSupportAttachmentStorageBase(file.name || "ek")}`
        const buffer = Buffer.from(await file.arrayBuffer())
        const up = await uploadBinaryToStorage(
          folderPrefix,
          storageFileName,
          buffer,
          mime
        )
        if (!up.ok) {
          throw new Error(up.message)
        }
        uploadedPaths.push(up.path)
        await prisma.supportTicketAttachment.create({
          data: {
            supportTicketId: row.id,
            storagePath: up.path,
            fileName: file.name?.trim() || up.fileName,
            mimeType: mime,
            sizeBytes: file.size,
          },
        })
      }
    } catch (e) {
      await prisma.supportTicket.delete({ where: { id: row.id } })
      await Promise.all(uploadedPaths.map((p) => deletePdfFromStorage(p)))
      const raw = e instanceof Error ? e.message : String(e)
      console.error("[support-tickets] POST attachment:", e)
      const msg =
        /undefined.*create|reading 'create'/i.test(raw)
          ? "Veritabanı istemcisi güncel değil. Terminalde `pnpm exec prisma generate` çalıştırıp dev sunucusunu yeniden başlatın (veya `pnpm dev` kullanın; `pnpm dev:fresh` artık generate çalıştırır)."
          : raw || "Ekler yüklenemedi."
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const full = await prisma.supportTicket.findUnique({
      where: { id: row.id },
      select: {
        id: true,
        subject: true,
        content: true,
        status: true,
        createdAt: true,
        attachments: { select: attachmentSelect, orderBy: { id: "asc" } },
      },
    })

    return NextResponse.json(full)
  } catch (e) {
    console.error("[support-tickets] POST:", e)
    const raw = e instanceof Error ? e.message : String(e)
    if (/undefined.*create|reading 'create'/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            "Veritabanı istemcisi güncel değil. `pnpm exec prisma generate` çalıştırıp dev sunucusunu yeniden başlatın.",
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: "Talep oluşturulamadı." }, { status: 500 })
  }
}
