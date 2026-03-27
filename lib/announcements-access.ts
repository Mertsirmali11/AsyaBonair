import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

export async function assertCanManageAnnouncements(): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const calisan = await prisma.calisan.findUnique({
    where: { email: session.user.email },
    select: { id: true, departman: true },
  })
  if (!calisan || !["Quality", "Human Resources"].includes(calisan.departman ?? "")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true }
}
