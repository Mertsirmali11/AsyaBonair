import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET: kayıtlı departman adları (Configurations → Departmanlar) — Planner'da task'a Departman/Grup ataması için, herhangi bir giriş yapmış kullanıcıya açık (yalnızca isim listesi, PII yok). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.customDepartment.findMany({ orderBy: { name: "asc" }, select: { name: true } })
  return NextResponse.json(rows.map((r) => r.name))
}
