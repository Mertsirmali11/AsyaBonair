import { redirect } from "next/navigation"

/** Eski sidebar URL’si; tek kaynak: /compliance/performance-reports */
export default function LegacyReportsRedirectPage() {
  redirect("/compliance/performance-reports")
}
