import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { nextBonMeMeetingNumber } from "@/lib/next-bon-me-number"

function getResend() {
  const { Resend } = require("resend") as typeof import("resend")
  return new Resend(process.env.RESEND_API_KEY)
}

/** "Tüm yıllar" seçildiğinde bellek/yanıt boyutu sınırı */
const MEETINGS_UNFILTERED_CAP = 500

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get("year")

  const where = year && year !== "All"
    ? {
        plannedDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      }
    : {}

  const meetings = await prisma.meeting.findMany({
    where,
    select: {
      id: true,
      meetingNo: true,
      title: true,
      plannedDate: true,
      initializedDate: true,
      isOnline: true,
      status: true,
      externalParticipants: true,
      meetingType: { select: { id: true, name: true, code: true } },
      participants: {
        select: {
          calisan: { select: { isim: true, soyisim: true } },
        },
      },
    },
    orderBy: { plannedDate: "desc" },
    ...(!year || year === "All" ? { take: MEETINGS_UNFILTERED_CAP } : {}),
  })

  return NextResponse.json(prismaJson(meetings))
}

type ExternalPayload =
  | string
  | { email?: string; firstName?: string; lastName?: string }

function normalizeExternalParticipants(raw: unknown): {
  json: string | null
  emails: string[]
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { json: null, emails: [] }
  }
  const stored: { email: string; firstName: string; lastName: string }[] = []
  const emails: string[] = []
  const seen = new Set<string>()

  for (const item of raw as ExternalPayload[]) {
    if (typeof item === "string") {
      const email = item.trim()
      if (!email.includes("@") || seen.has(email.toLowerCase())) continue
      seen.add(email.toLowerCase())
      stored.push({ email, firstName: "", lastName: "" })
      emails.push(email)
      continue
    }
    if (item && typeof item === "object") {
      const email = String(item.email ?? "").trim()
      if (!email.includes("@") || seen.has(email.toLowerCase())) continue
      seen.add(email.toLowerCase())
      stored.push({
        email,
        firstName: String(item.firstName ?? "").trim(),
        lastName: String(item.lastName ?? "").trim(),
      })
      emails.push(email)
    }
  }

  return {
    json: stored.length > 0 ? JSON.stringify(stored) : null,
    emails,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, plannedDate, meetingTypeId, participantIds, externalEmails, isOnline, agenda } = body

  const { json: externalJson, emails: externalEmailList } =
    normalizeExternalParticipants(externalEmails)

  const nextNo = await nextBonMeMeetingNumber(prisma)
  if (nextNo > 999) {
    return NextResponse.json(
      { error: "BON-ME numarası üst sınırına (999) ulaşıldı" },
      { status: 400 }
    )
  }
  const meetingNo = `BON-ME-${String(nextNo).padStart(3, "0")}`

  const meeting = await prisma.meeting.create({
    data: {
      meetingNo,
      title,
      plannedDate: new Date(plannedDate),
      initializedDate: new Date(),
      isOnline: isOnline ?? false,
      agenda,
      meetingType: meetingTypeId ? { connect: { id: BigInt(meetingTypeId) } } : undefined,
      status: "Planned",
      externalParticipants: externalJson,
      participants: {
        create: (participantIds ?? []).map((id: number) => ({ calisanId: id })),
      },
    },
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true, email: true } } },
      },
    },
  })

  const internalEmails = meeting.participants
    .map(p => p.calisan.email)
    .filter(Boolean) as string[]

  const allEmails = [...internalEmails, ...externalEmailList]

  if (allEmails.length > 0) {
    try {
      await getResend().emails.send({
        from: "Bonair <onboarding@resend.dev>",
        to: allEmails,
        subject: `📅 Meeting Invitation: ${title}`,
        html: `
          <h2>You are invited to a meeting</h2>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Date:</strong> ${new Date(plannedDate).toLocaleDateString("tr-TR")}</p>
          <p><strong>Meeting No:</strong> ${meetingNo}</p>
          ${isOnline ? "<p><strong>Type:</strong> Online Meeting</p>" : ""}
          ${agenda ? `<p><strong>Agenda:</strong> ${agenda}</p>` : ""}
          <hr />
          <small>Bonair SMS System</small>
        `,
      })
    } catch (e) {
      console.error("Mail sending failed:", e)
    }
  }

  return NextResponse.json(prismaJson(meeting))
}
