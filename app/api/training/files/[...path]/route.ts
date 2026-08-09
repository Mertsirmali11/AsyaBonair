import { NextResponse } from "next/server"

import { assertCanManageTraining } from "@/lib/training-access"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const { path: pathArray } = await params
  const storagePath = pathArray.join("/")

  const signed = await createSignedDownloadUrl(storagePath)
  if (!signed.ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  return NextResponse.redirect(signed.url)
}
