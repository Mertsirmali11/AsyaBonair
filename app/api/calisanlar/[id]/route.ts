import { NextResponse } from "next/server"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { deleteCalisanAvatarFromStorage } from "@/lib/supabase-storage"
import bcrypt from "bcryptjs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const calisan = await prisma.calisan.findUnique({
      where: { id: parseInt(id) },
    })

    if (!calisan) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      )
    }

    const { profilFotoStoragePath, password: _pw, ...safe } = calisan
    return NextResponse.json({
      ...safe,
      profilFotoUrl: calisanAvatarPublicUrl(profilFotoStoragePath),
    })
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const isPilot = body.departman === "Pilot"
    const pilotRanks = ["Captain", "F/O"]

    if (isPilot && !pilotRanks.includes(body.ekstra3)) {
      return NextResponse.json(
        { error: "Pilot position must be Captain or F/O" },
        { status: 400 }
      )
    }

    let updateData: any = {
      isim: body.isim,
      soyisim: body.soyisim,
      departman: body.departman,
      tcNo: body.tcNo || null,
      dogumTarihi: body.dogumTarihi ? new Date(body.dogumTarihi) : null,
      telNo: body.telNo,
      adres: body.adres,
      anneAdi: body.anneAdi,
      babaAdi: body.babaAdi,
      medeniDurum: body.medeniDurum,
      cocuk: body.cocuk ? parseInt(body.cocuk) : 0,
      kanGrubu: body.kanGrubu,
      email: body.email,
      egitimDurum: body.egitimDurum,
      acilIletisim: body.acilIletisim,
      acilIletisimTel: body.acilIletisimTel,
      sgkSicilNo: body.sgkSicilNo,
      bankaAdi: body.bankaAdi,
      iban: body.iban,
      iseGirisTarihi: body.iseGirisTarihi ? new Date(body.iseGirisTarihi) : null,
      istenCikisTarihi: body.istenCikisTarihi ? new Date(body.istenCikisTarihi) : null,
      ekstra1: body.ekstra1,
      ekstra2: body.ekstra2,
      ekstra3: body.ekstra3,
    }

    if (body.password && body.password.trim() !== "") {
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    const calisan = await prisma.calisan.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    const { profilFotoStoragePath, password: _pw, ...safe } = calisan
    return NextResponse.json({
      ...safe,
      profilFotoUrl: calisanAvatarPublicUrl(profilFotoStoragePath),
    })
  } catch (error: any) {
    console.error("Error updating employee:", error)

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This email or ID number is already registered" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numericId = parseInt(id)
    const existing = await prisma.calisan.findUnique({
      where: { id: numericId },
      select: { profilFotoStoragePath: true },
    })
    if (existing?.profilFotoStoragePath) {
      await deleteCalisanAvatarFromStorage(existing.profilFotoStoragePath)
    }
    await prisma.calisan.delete({
      where: { id: numericId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting employee:", error)
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    )
  }
}
