import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SafetySettingsClient } from "@/components/safety-settings-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { canAccessQualityOrAdminSettings } from "@/lib/department-access"

export default async function SafetySettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessQualityOrAdminSettings(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Configurations · Safety settings" />
      <div className="flex min-h-full min-w-0 flex-1 flex-col bg-background">
        <div className="safety-settings-shell flex min-w-0 flex-col gap-8 px-4 pb-8 pt-6 md:px-6 md:pt-8">
          <div className="flex shrink-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="ss-page-heading text-2xl md:text-[1.65rem]">Safety settings</h1>
            </div>
            <Breadcrumb className="ss-breadcrumb shrink-0 sm:mt-1">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/configurations">Configurations</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Safety settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <SafetySettingsClient />
        </div>
      </div>
    </>
  )
}
