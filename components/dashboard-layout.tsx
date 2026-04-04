"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DmInboxProvider } from "@/components/dm-inbox-provider"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

interface User {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User
  headerTitle?: string
}

export function DashboardLayout({ children, user, headerTitle }: DashboardLayoutProps) {
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
        <AppSidebar variant="inset" user={user} />
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SiteHeader user={user} title={headerTitle} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain">
              {children}
            </div>
          </div>
        </SidebarInset>
      </DmInboxProvider>
    </SidebarProvider>
  )
}
