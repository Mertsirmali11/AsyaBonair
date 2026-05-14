import { NextResponse } from "next/server"

/**
 * Bu endpoint devre dışı bırakıldı.
 * Kullanıcı kayıtları yalnızca admin onaylı işçi kayıt akışı
 * (/configurations/new-worker) üzerinden yapılabilir.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Registration is not available. Contact your administrator." },
    { status: 403 }
  )
}

