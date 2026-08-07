import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { path: pathArray } = await params
    const fileName = pathArray[pathArray.length - 1]
    const paperNo = pathArray[0]

    const storagePath = `${paperNo}/${fileName}`

    // Vercel fonksiyonu dosyayı buffer'lamaz — tarayıcı doğrudan Supabase'e
    // yönlendirilir (büyük ekler için de çalışır, ~4.5MB yanıt sınırı yok).
    const signed = await createSignedDownloadUrl(storagePath)
    if (!signed.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    return NextResponse.redirect(signed.url)
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json(
      { error: "Could not serve file" },
      { status: 500 }
    )
  }
}
