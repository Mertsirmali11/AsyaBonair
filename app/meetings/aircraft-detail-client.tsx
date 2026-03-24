"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type AircraftDetail = {
  id: number
  register: string
  msn: string
}

export function AircraftDetailClient({
  aircraft,
}: {
  aircraft: AircraftDetail
  currentUserId: number
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Uçak bilgisi</CardTitle>
          <CardDescription>
            Kayıt ve MSN bilgileri; belge yükleme akışı ileride bu sayfaya
            bağlanabilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">Register</p>
            <p className="text-lg font-semibold">{aircraft.register}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">MSN</p>
            <p className="text-lg font-semibold">{aircraft.msn}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Belgeler</CardTitle>
          <CardDescription>
            Bu uçağa ait doküman listesi ve yükleme henüz tanımlanmadı.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/meetings">Toplantı planlarına dön</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
