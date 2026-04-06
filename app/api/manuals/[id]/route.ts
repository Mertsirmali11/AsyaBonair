import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const manual = await prisma.companyManual.findUnique({
    where: { id: numericId },
    select: { id: true, title: true, contentText: true },
  })

  if (!manual) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ manual })
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
    await prisma.companyManual.delete({ where: { id: numericId } })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("DELETE manual:", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
