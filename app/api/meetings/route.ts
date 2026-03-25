import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

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
    include: {
      meetingType: true,
      participants: {
        include: { calisan: { select: { isim: true, soyisim: true } } },
      },
    },
    orderBy: { plannedDate: "desc" },
  })

  return NextResponse.json(prismaJson(meetings))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, plannedDate, meetingTypeId, participantIds, externalEmails, isOnline, agenda } = body

  const existing = await prisma.meeting.findMany({
    select: { meetingNo: true },
    orderBy: { id: "asc" },
  })

  const usedNumbers = existing
    .map(m => parseInt(m.meetingNo?.replace("BON-ME-", "") ?? "0"))
    .filter(n => !isNaN(n))

  let nextNo = 1
  while (usedNumbers.includes(nextNo)) { nextNo++ }

  const meetingNo = `BON-ME-${String(nextNo).padStart(3, "0")}`

  const meeting = await prisma.meeting.create({
    data: {
      meetingNo,
      title,
      plannedDate: new Date(plannedDate),
      initializedDate: new Date(),
      isOnline: isOnline ?? false,
      agenda,
      meetingType: meetingTypeId ? { connect: { id: parseInt(meetingTypeId) } } : undefined,
      status: "Planned",
      externalParticipants: externalEmails ? JSON.stringify(externalEmails) : null,
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

  const allEmails = [...internalEmails, ...(externalEmails ?? [])]

  if (allEmails.length > 0) {
    try {
      await resend.emails.send({
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
