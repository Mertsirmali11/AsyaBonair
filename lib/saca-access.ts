import "server-only"

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

/** SACA Score erişimi — Compliance Monitoring departmanı ile aynı kapıyı kullanır. */
export async function assertCanViewSaca(): Promise<
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

/** Sayfa (server component) tarafı için: true/false döner, yönlendirme çağıran tarafta yapılır. */
export async function canViewSacaForSession(
  departman: string | null | undefined
): Promise<boolean> {
  const permissions = await getResolvedDepartmentPermissionsForUser(departman)
  return !!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]
}
