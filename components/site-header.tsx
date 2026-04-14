"use client"

import * as React from "react"
import { Separator } from "@/components/ui/separator"
import {
  useWorkspacePageTitle,
  useWorkspaceTitleAccessory,
} from "@/components/workspace-page-title"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DmHeaderInbox } from "@/components/dm-header-inbox"
import { IstanbulClock } from "@/components/istanbul-clock"

interface SiteHeaderProps {
  user?: {
    name?: string | null
    email?: string | null
    avatar?: string | null
    departman?: string | null
  }
  /** Optional override when outside workspace title context */
  title?: string
}

function getInitials(name?: string | null): string {
  if (!name) return "U"
  const parts = name.split(" ")
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name[0].toUpperCase()
}

function PageTitleWithAccessory({
  title,
  accessory,
}: {
  title: string
  accessory: React.ReactNode | null
}) {
  if (!accessory) {
    return (
      <h1 className="min-w-0 truncate text-base font-medium" title={title}>
        {title}
      </h1>
    )
  }
  const sep = " · "
  const idx = title.lastIndexOf(sep)
  if (idx === -1) {
    return (
      <h1 className="flex min-h-0 min-w-0 items-center gap-1 text-base font-medium">
        <span className="truncate" title={title}>
          {title}
        </span>
        {accessory}
      </h1>
    )
  }
  const before = title.slice(0, idx + sep.length)
  const last = title.slice(idx + sep.length)
  return (
    <h1 className="flex min-h-0 min-w-0 max-w-full items-center gap-1 text-base font-medium">
      <span className="min-w-0 truncate" title={before + last}>
        {before}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {last}
        {accessory}
      </span>
    </h1>
  )
}

export function SiteHeader({ user, title: titleProp }: SiteHeaderProps) {
  const titleFromContext = useWorkspacePageTitle()
  const title = titleProp ?? titleFromContext
  const titleAccessory = useWorkspaceTitleAccessory()
  const initials = getInitials(user?.name)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <PageTitleWithAccessory title={title} accessory={titleAccessory} />
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <DmHeaderInbox />
          <IstanbulClock />
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-medium text-foreground leading-tight">
                  {user.name || "User"}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {user.email || ""}
                </span>
                {user.departman && (
                  <span className="text-xs text-muted-foreground leading-tight">
                    {user.departman}
                  </span>
                )}
              </div>
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={user.avatar || undefined} alt={user.name || "User"} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
