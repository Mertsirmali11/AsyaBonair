import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canApproveWorkerRegistrations } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"
import {
  deleteCalisanAvatarFromStorage,
  downloadCalisanAvatarFromStorage,
  uploadCalisanAvatarFromBuffer,
} from "@/lib/supabase-storage"
import { hireDateFromApprovalTimestamp } from "@/lib/approval-hire-date"
import { workerRegistrationPhotoPublicUrl } from "@/lib/worker-registration-photo-url"
import {
  isPilotDepartmentName,
  PILOT_RANKS,
} from "@/lib/worker-registration-constants"
import {
  fetchRegisteredDepartmentNames,
  isDepartmentInRegistry,
} from "@/lib/organization-departments"

function mimeFromPath(p: string): string {
  const lower = p.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

async function requireApprover() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!canApproveWorkerRegistrations(session.user.departman)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  const reviewerId = Number.parseInt(session.user.id, 10)
  if (!Number.isFinite(reviewerId) || reviewerId < 1) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) }
  }
  return { session, reviewerId }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApprover()
  if ("error" in gate) return gate.error

  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const row = await prisma.workerRegistrationRequest.findUnique({
    where: { id },
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

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { profilFotoStoragePath, ...rest } = row
  return NextResponse.json({
    ...rest,
    profilFotoUrl: workerRegistrationPhotoPublicUrl(profilFotoStoragePath),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApprover()
  if ("error" in gate) return gate.error
  const { reviewerId } = gate

  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string
    reason?: string
    departman?: string
    ekstra3?: string
  } | null
  const action = body?.action
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 })
  }

  const pending = await prisma.workerRegistrationRequest.findUnique({
    where: { id },
  })

  if (!pending) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (pending.status !== "PENDING") {
    return NextResponse.json(
      { error: "This registration is no longer pending." },
      { status: 409 }
    )
  }

  if (action === "reject") {
    const reason = (body?.reason || "").trim() || null
    if (pending.profilFotoStoragePath) {
      await deleteCalisanAvatarFromStorage(pending.profilFotoStoragePath)
    }
    await prisma.workerRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByCalisanId: reviewerId,
        rejectionReason: reason,
        profilFotoStoragePath: null,
      },
    })
    return NextResponse.json({ ok: true })
  }

  const emailTaken = await prisma.calisan.findUnique({
    where: { email: pending.email },
    select: { id: true },
  })
  if (emailTaken) {
    return NextResponse.json(
      { error: "An employee with this email already exists. Reject this registration instead." },
      { status: 409 }
    )
  }

  if (pending.tcNo) {
    const tcTaken = await prisma.calisan.findFirst({
      where: { tcNo: pending.tcNo },
      select: { id: true },
    })
    if (tcTaken) {
      return NextResponse.json(
        { error: "This ID number is already in use. Reject this registration instead." },
        { status: 409 }
      )
    }
  }

  const departman = (body?.departman || "").trim()
  if (!departman) {
    return NextResponse.json(
      { error: "Department is required when approving. Choose a department for this worker." },
      { status: 400 }
    )
  }
  const deptRegistry = await fetchRegisteredDepartmentNames(prisma)
  if (!isDepartmentInRegistry(departman, deptRegistry)) {
    return NextResponse.json(
      {
        error:
          "Geçersiz departman. Önce Configurations → Departmanlar’da tanımlayın.",
      },
      { status: 400 }
    )
  }

  const pilotRank = (body?.ekstra3 || "").trim()
  if (isPilotDepartmentName(departman)) {
    if (!PILOT_RANKS.includes(pilotRank as (typeof PILOT_RANKS)[number])) {
      return NextResponse.json(
        { error: "Pilot department requires position Captain or F/O." },
        { status: 400 }
      )
    }
  }

  const hireDate = hireDateFromApprovalTimestamp()

  const calisan = await prisma.calisan.create({
    data: {
      isim: pending.isim,
      soyisim: pending.soyisim,
      departman,
      tcNo: pending.tcNo,
      dogumTarihi: pending.dogumTarihi,
      telNo: pending.telNo,
      adres: pending.adres,
      anneAdi: pending.anneAdi,
      babaAdi: pending.babaAdi,
      medeniDurum: pending.medeniDurum,
      cocuk: pending.cocuk,
      kanGrubu: pending.kanGrubu,
      email: pending.email,
      egitimDurum: pending.egitimDurum,
      acilIletisim: pending.acilIletisim,
      acilIletisimTel: pending.acilIletisimTel,
      sgkSicilNo: pending.sgkSicilNo,
      bankaAdi: pending.bankaAdi,
      iban: pending.iban,
      iseGirisTarihi: hireDate,
      istenCikisTarihi: pending.istenCikisTarihi,
      password: pending.password,
      ekstra1: pending.ekstra1,
      ekstra2: pending.ekstra2,
      ekstra3: departman === "Pilot" ? pilotRank : null,
    },
  })

  let profilPath: string | null = null
  if (pending.profilFotoStoragePath) {
    const buf = await downloadCalisanAvatarFromStorage(pending.profilFotoStoragePath)
    if (buf && buf.length > 0) {
      const mime = mimeFromPath(pending.profilFotoStoragePath)
      const uploaded = await uploadCalisanAvatarFromBuffer(buf, calisan.id, mime)
      if (uploaded.ok) {
        profilPath = uploaded.path
        await deleteCalisanAvatarFromStorage(pending.profilFotoStoragePath)
      }
    }
  }

  if (profilPath) {
    await prisma.calisan.update({
      where: { id: calisan.id },
      data: { profilFotoStoragePath: profilPath },
    })
  }

  await prisma.workerRegistrationRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByCalisanId: reviewerId,
      approvedCalisanId: calisan.id,
      profilFotoStoragePath: null,
      departman,
      iseGirisTarihi: hireDate,
      ekstra3: departman === "Pilot" ? pilotRank : null,
    },
  })

  return NextResponse.json({
    ok: true,
    calisanId: calisan.id,
  })
}
