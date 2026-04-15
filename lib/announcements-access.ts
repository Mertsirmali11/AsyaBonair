import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  isAdminDepartment,
  normalizeDepartmentKey,
} from "@/lib/department-access"

/**
 * DB’deki departman boş/yanlış biçimde olsa bile oturumdaki değeri yedek olarak kullanır
 * (`??` yalnızca null/undefined için çalışır; boş string için kullanılmaz).
 */
export function effectiveEmployeeDepartman(
  dbValue: string | null | undefined,
  sessionValue: string | null | undefined
): string | null {
  const fromDb = (dbValue ?? "").trim()
  if (fromDb.length > 0) return fromDb
  const fromSession = (sessionValue ?? "").trim()
  return fromSession.length > 0 ? fromSession : null
}

export function canManageAnnouncementsForDepartman(
  departman: string | null | undefined
): boolean {
  if (isAdminDepartment(departman)) return true
  const x = normalizeDepartmentKey(departman)
  return (
    x === "quality" ||
    x === "human resources" ||
    x === "administrative affairs"
  )
}

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
  const email = (session.user.email ?? "").trim()
  const calisan = email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, departman: true },
      })
    : null
  const departman = effectiveEmployeeDepartman(
    calisan?.departman,
    session.user.departman
  )
  if (!calisan || !canManageAnnouncementsForDepartman(departman)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true }
}

/** Controlled Documents → Manuals: yalnızca Admin departmanı yükler / siler / revize eder. */
export async function assertCanManageCompanyManuals(): Promise<
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
  const email = (session.user.email ?? "").trim()
  const calisan = email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, departman: true },
      })
    : null
  const departman = effectiveEmployeeDepartman(
    calisan?.departman,
    session.user.departman
  )
  if (!calisan || !isAdminDepartment(departman)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Bu işlem için Admin departmanındaki bir hesap gerekir.",
        },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}
