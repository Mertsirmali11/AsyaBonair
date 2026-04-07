import type { ReactNode } from "react"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export type ConfigurationsPageShellProps = {
  workspaceTitle: string
  pageTitle: string
  breadcrumbCurrent: string
  children: ReactNode
}

export function ConfigurationsPageShell({
  workspaceTitle,
  pageTitle,
  breadcrumbCurrent,
  children,
}: ConfigurationsPageShellProps) {
  return (
    <>
      <SetWorkspacePageTitle title={workspaceTitle} />
      <div className="flex min-h-full min-w-0 flex-1 flex-col bg-background">
        <div className="configurations-shell flex min-w-0 flex-col gap-8 px-4 pb-8 pt-6 md:px-6 md:pt-8">
          <header className="flex shrink-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="ss-page-heading text-2xl md:text-[1.65rem]">{pageTitle}</h1>
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
                  <BreadcrumbPage>{breadcrumbCurrent}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          {children}
        </div>
      </div>
    </>
  )
}
