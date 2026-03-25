import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

async function assertCanManageAnnouncements() {
  const session = await auth()
  if (!session?.user?.email) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user.email },
    select: { id: true, departman: true },
  })
  if (!calisan || !["Quality", "Human Resources"].includes(calisan.departman ?? "")) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    await prisma.announcement.delete({
      where: { id: numericId },
    })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    console.error("DELETE announcement:", e)
    return NextResponse.json({ error: "Could not delete announcement" }, { status: 500 })
  }
}
