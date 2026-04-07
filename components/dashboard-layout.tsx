"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { DmInboxProvider } from "@/components/dm-inbox-provider"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { WorkspacePageTitleProvider } from "@/components/workspace-page-title"

interface User {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User
  /** Audit Plan menü öğesi — sunucuda `canAccessAuditPlan` ile hesaplanır */
  showAuditPlanNav?: boolean
  /** Üst başlık (SiteHeader); verilmezse sayfa `SetWorkspacePageTitle` kullanır */
  headerTitle?: string
}

/** Rota değişince başlık state'i yeniden mount ile sıfırlanır (useInsertionEffect/setState yasak). */
function WorkspaceInsetWithTitle({
  user,
  children,
  headerTitle,
}: {
  user: User
  children: React.ReactNode
  headerTitle?: string
}) {
  const pathname = usePathname()
  return (
    <WorkspacePageTitleProvider key={pathname}>
      <SiteHeader user={user} title={headerTitle} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain">
          {children}
        </div>
      </div>
    </WorkspacePageTitleProvider>
  )
}

export function DashboardLayout({
  children,
  user,
  showAuditPlanNav = false,
  headerTitle,
}: DashboardLayoutProps) {
  return (
    <SidebarProvider
      className="h-dvh max-h-dvh min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <DmInboxProvider>
        <AppSidebar variant="inset" user={user} showAuditPlanNav={showAuditPlanNav} />
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspaceInsetWithTitle user={user} headerTitle={headerTitle}>
            {children}
          </WorkspaceInsetWithTitle>
        </SidebarInset>
      </DmInboxProvider>
    </SidebarProvider>
  )
}
