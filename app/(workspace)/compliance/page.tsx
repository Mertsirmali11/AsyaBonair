import Link from "next/link"

import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default function ComplianceMonitoringPage() {
  return (
    <>
      <SetWorkspacePageTitle title="Compliance Monitoring" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          Compliance Monitoring giriş sayfası.{" "}
          <Link href="/compliance/audit-plan" className="text-foreground underline underline-offset-2">
            Audit Plan
          </Link>{" "}
          ve{" "}
          <Link href="/compliance/checklists" className="text-foreground underline underline-offset-2">
            Checklists
          </Link>{" "}
          alt menüden açılır (yetkili kullanıcılar).
        </p>
      </div>
    </>
  )
}
