import "server-only"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

/** SHGM Mevzuat yönetimi — Compliance izniyle aynı kapıyı kullanır (bkz. lib/sidebar-nav-visibility.ts). */
export async function assertCanManageShgmMevzuat(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { departman: true },
  })
  const departman = calisan?.departman ?? session.user.departman
  const permissions = await getResolvedDepartmentPermissionsForUser(departman)

  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true }
}
