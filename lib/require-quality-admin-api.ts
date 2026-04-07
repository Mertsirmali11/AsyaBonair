import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canAccessQualityOrAdminSettings } from "@/lib/department-access"

export async function requireQualityOrAdminApi(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const session = await auth()
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (!canAccessQualityOrAdminSettings(session.user?.departman)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true }
}
