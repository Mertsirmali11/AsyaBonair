import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const calisanlar = await prisma.calisan.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
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
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(calisanlar)
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const isPilot = body.departman === "Pilot"
    const pilotRanks = ["Captain", "F/O"]

    if (isPilot && !pilotRanks.includes(body.ekstra3)) {
      return NextResponse.json(
        { error: "Pilot position must be Captain or F/O" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(body.password || "123456", 10)

    const calisan = await prisma.calisan.create({
      data: {
        isim: body.isim,
        soyisim: body.soyisim,
        departman: body.departman,
        tcNo: body.tcNo,
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
        password: hashedPassword,
        ekstra1: body.ekstra1,
        ekstra2: body.ekstra2,
        ekstra3: body.ekstra3,
      },
    })

    return NextResponse.json(calisan, { status: 201 })
  } catch (error: any) {
    console.error("Error adding employee:", error)
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This email or ID number is already registered" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to add employee" },
      { status: 500 }
    )
  }
}
