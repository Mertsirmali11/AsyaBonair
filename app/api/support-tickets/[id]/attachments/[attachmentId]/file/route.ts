import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { canManageSupportTicketsAsAdmin } from "@/lib/support-ticket-access"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

function inlineContentDisposition(fileName: string): string {
  const safe = (fileName || "download").replace(/[\r\n"]/g, "_")
  const ascii =
    safe.replace(/[^\x20-\x7E]/g, "_").replace(/[/\\?%*:|"<>]/g, "_") || "download"
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> }
) {
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

    const { id: ticketIdStr, attachmentId: attachmentIdStr } = await params
    const ticketId = parseInt(ticketIdStr, 10)
    const attachmentId = parseInt(attachmentIdStr, 10)
    if (isNaN(ticketId) || isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const attachment = await prisma.supportTicketAttachment.findFirst({
      where: { id: attachmentId, supportTicketId: ticketId },
      include: {
        supportTicket: { select: { createdBy: true } },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isAdmin = canManageSupportTicketsAsAdmin(calisan.departman)
    const isOwner = attachment.supportTicket.createdBy === calisan.id
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buffer = await downloadPdfFromStorage(attachment.storagePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      )
    }

    const contentType = attachment.mimeType || "application/octet-stream"

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": inlineContentDisposition(attachment.fileName),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e) {
    console.error("GET support ticket attachment file:", e)
    return NextResponse.json({ error: "Could not serve file" }, { status: 500 })
  }
}
