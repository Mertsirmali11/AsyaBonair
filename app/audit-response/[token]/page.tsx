import type { Metadata } from "next"
import { AuditResponsePublicClient } from "@/components/audit-response-public-client"

export const metadata: Metadata = {
  title: "Audit Response — Bonjour",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ token: string }> }

/**
 * Public Audit Response Link — Bonjour hesabı GEREKTİRMEZ. Kasıtlı olarak
 * app/(workspace) route grubunun DIŞINDA: sidebar/menü/diğer sayfalara erişim yok,
 * yalnızca token ile eşleşen tek denetime ait sade cevap ekranı render edilir.
 */
export default async function AuditResponsePage({ params }: Props) {
  const { token } = await params
  return <AuditResponsePublicClient token={token} />
}
