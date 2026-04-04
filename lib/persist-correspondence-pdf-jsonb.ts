import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"

type AttachmentRow = { path: string; fileName: string }

/**
 * Persists pdf_attachments after create. Uses Prisma update (not raw SQL) so it works
 * reliably with Prisma 7 + adapter-pg — $executeRawUnsafe($1) was not updating rows.
 */
export async function setOutgoingPdfAttachmentsJsonb(
  id: number,
  attachments: AttachmentRow[] | null
): Promise<void> {
  await prisma.outgoingCorrespondence.update({
    where: { id },
    data: {
      pdfAttachments:
        attachments && attachments.length > 0
          ? (attachments as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
  })
}

export async function setIncomingPdfAttachmentsJsonb(
  id: number,
  attachments: AttachmentRow[] | null
): Promise<void> {
  await prisma.incomingPaper.update({
    where: { id },
    data: {
      pdfAttachments:
        attachments && attachments.length > 0
          ? (attachments as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
  })
}
