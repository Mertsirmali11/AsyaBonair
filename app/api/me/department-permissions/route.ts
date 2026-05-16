import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const permissions = await getResolvedDepartmentPermissionsForUser(
      session.user.departman
    )
    return NextResponse.json({ permissions })
  } catch (e) {
    console.error("GET /api/me/department-permissions:", e)
    return NextResponse.json(
      { error: "İzinler yüklenemedi." },
      { status: 500 }
    )
  }
}
