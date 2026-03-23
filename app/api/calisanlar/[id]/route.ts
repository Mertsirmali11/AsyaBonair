import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import bcrypt from "bcryptjs"

// GET - Get single employee
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

    return NextResponse.json(calisan)
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    )
  }
}

// PUT - Update employee
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const isPilot = body.departman === "Pilot"
    const pilotRanks = ["Kaptan", "F/O"]

    if (isPilot && !pilotRanks.includes(body.ekstra3)) {
      return NextResponse.json(
        { error: "Pilot mevki alanı sadece Kaptan veya F/O olabilir" },
        { status: 400 }
      )
    }

    // Prepare update data
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

    // If password is being changed
    if (body.password && body.password.trim() !== "") {
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    const calisan = await prisma.calisan.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json(calisan)
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

// DELETE - Delete employee
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.calisan.delete({
      where: { id: parseInt(id) },
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
