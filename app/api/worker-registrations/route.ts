import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/auth"
import { canApproveWorkerRegistrations } from "@/lib/department-access"
import { validatePassword, passwordPolicyMessage } from "@/lib/password-policy"
import { prisma } from "@/lib/prisma-server"
import { turkeyDateStringToIso } from "@/lib/turkey-date"
import { uploadPendingWorkerPhotoToStorage, CALISAN_AVATAR_MAX_BYTES } from "@/lib/supabase-storage"
import { workerRegistrationPhotoPublicUrl } from "@/lib/worker-registration-photo-url"

function parseFormDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null
  const t = s.trim()
  if (t.includes(".")) {
    const iso = turkeyDateStringToIso(t)
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === "string" ? v.trim() : ""
}

function withPhotoUrl<T extends { profilFotoStoragePath: string | null }>(
  row: T
): Omit<T, "profilFotoStoragePath"> & { profilFotoUrl: string | null } {
  const { profilFotoStoragePath, ...rest } = row
  return {
    ...rest,
    profilFotoUrl: workerRegistrationPhotoPublicUrl(profilFotoStoragePath),
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canApproveWorkerRegistrations(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status") || "PENDING"
    const where =
      statusParam === "ALL"
        ? {}
        : { status: statusParam as "PENDING" | "APPROVED" | "REJECTED" }

    const rows = await prisma.workerRegistrationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        isim: true,
        soyisim: true,
        departman: true,
        tcNo: true,
        dogumTarihi: true,
        telNo: true,
        adres: true,
        anneAdi: true,
        babaAdi: true,
        medeniDurum: true,
        cocuk: true,
        kanGrubu: true,
        email: true,
        egitimDurum: true,
        acilIletisim: true,
        acilIletisimTel: true,
        sgkSicilNo: true,
        bankaAdi: true,
        iban: true,
        iseGirisTarihi: true,
        istenCikisTarihi: true,
        ekstra1: true,
        ekstra2: true,
        ekstra3: true,
        profilFotoStoragePath: true,
        reviewedAt: true,
        reviewedByCalisanId: true,
        rejectionReason: true,
        approvedCalisanId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(rows.map((r) => withPhotoUrl(r)))
  } catch (e) {
    console.error("worker-registrations GET:", e)
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : ""
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : ""
    const missingTable =
      code === "P2021" ||
      /worker_registration_requests|does not exist|relation.*does not exist/i.test(
        message
      )
    const hint = missingTable
      ? " The worker registrations table is missing. Run: npx prisma db push — or apply the SQL migration under prisma/migrations/…/worker_registration_requests."
      : ""
    return NextResponse.json(
      {
        error: `Could not load registrations.${hint}`,
        ...(process.env.NODE_ENV === "development" && {
          debug: message || String(e),
        }),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()

    const isim = str(form, "isim")
    const soyisim = str(form, "soyisim")
    const email = str(form, "email").toLowerCase()
    const password = str(form, "password")
    if (!isim || !soyisim || !email || !password) {
      return NextResponse.json(
        { error: "First name, last name, email, and password are required." },
        { status: 400 }
      )
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: `Parola politikasına uymuyor: ${pwCheck.errors.join("; ")}. Gereksinimler: ${passwordPolicyMessage()}` },
        { status: 400 }
      )
    }

    const existingEmployee = await prisma.calisan.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existingEmployee) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      )
    }

    const pendingSameEmail = await prisma.workerRegistrationRequest.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    })
    if (pendingSameEmail) {
      return NextResponse.json(
        { error: "A registration with this email is already pending review." },
        { status: 400 }
      )
    }

    const tcNo = str(form, "tcNo") || null
    if (tcNo) {
      const tcTaken = await prisma.calisan.findFirst({
        where: { tcNo },
        select: { id: true },
      })
      if (tcTaken) {
        return NextResponse.json(
          { error: "This ID number is already registered." },
          { status: 400 }
        )
      }
      const tcPending = await prisma.workerRegistrationRequest.findFirst({
        where: { tcNo, status: "PENDING" },
        select: { id: true },
      })
      if (tcPending) {
        return NextResponse.json(
          { error: "This ID number is already used in a pending registration." },
          { status: 400 }
        )
      }
    }

    const cocukRaw = str(form, "cocuk")
    const cocuk = cocukRaw ? Math.max(0, parseInt(cocukRaw, 10) || 0) : 0

    const hashedPassword = await bcrypt.hash(password, 10)

    const created = await prisma.workerRegistrationRequest.create({
      data: {
        isim,
        soyisim,
        departman: null,
        tcNo,
        dogumTarihi: parseFormDate(str(form, "dogumTarihi")),
        telNo: str(form, "telNo") || null,
        adres: str(form, "adres") || null,
        anneAdi: str(form, "anneAdi") || null,
        babaAdi: str(form, "babaAdi") || null,
        medeniDurum: str(form, "medeniDurum") || null,
        cocuk,
        kanGrubu: str(form, "kanGrubu") || null,
        email,
        egitimDurum: str(form, "egitimDurum") || null,
        acilIletisim: str(form, "acilIletisim") || null,
        acilIletisimTel: str(form, "acilIletisimTel") || null,
        sgkSicilNo: str(form, "sgkSicilNo") || null,
        bankaAdi: str(form, "bankaAdi") || null,
        iban: str(form, "iban") || null,
        iseGirisTarihi: null,
        istenCikisTarihi: null,
        password: hashedPassword,
        ekstra1: null,
        ekstra2: null,
        ekstra3: null,
      },
    })

    const photo = form.get("photo")
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > CALISAN_AVATAR_MAX_BYTES) {
        await prisma.workerRegistrationRequest.delete({ where: { id: created.id } })
        return NextResponse.json(
          { error: `Photo must be at most ${CALISAN_AVATAR_MAX_BYTES / (1024 * 1024)} MB.` },
          { status: 400 }
        )
      }
      const uploaded = await uploadPendingWorkerPhotoToStorage(photo, created.id)
      if (!uploaded.ok) {
        await prisma.workerRegistrationRequest.delete({ where: { id: created.id } })
        return NextResponse.json({ error: uploaded.message }, { status: 500 })
      }
      await prisma.workerRegistrationRequest.update({
        where: { id: created.id },
        data: { profilFotoStoragePath: uploaded.path },
      })
    }

    return NextResponse.json(
      {
        id: created.id,
        message:
          "Registration submitted. You will be able to sign in after an administrator approves your request.",
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("worker-registrations POST:", e)
    return NextResponse.json(
      { error: "Registration failed. Please try again later." },
      { status: 500 }
    )
  }
}
