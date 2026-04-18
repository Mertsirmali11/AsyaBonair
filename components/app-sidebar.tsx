"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconChevronDown,
  IconClipboardCheck,
  IconDashboard,
  IconFileDescription,
  IconInbox,
  IconLogout,
  IconMail,
  IconMessage,
  IconPuzzle,
  IconRobot,
  IconSettings,
  IconShieldCheck,
  IconSpeakerphone,
  IconTicket,
  IconUrgent,
  IconUser,
} from "@tabler/icons-react"

import { useDmInbox } from "@/components/dm-inbox-provider"
import { cn } from "@/lib/utils"
import {
  canAccessConfigurationsArea,
  canAccessQualityOrAdminSettings,
  canApproveWorkerRegistrations,
} from "@/lib/department-access"
import {
  canViewComplianceMonitoringNav,
  canViewSafetyManagementNav,
} from "@/lib/sidebar-nav-access"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface User {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_TOP: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Support Ticket", url: "/support-tickets", icon: IconTicket },
  { title: "Report Hazard", url: "/report-hazard", icon: IconAlertTriangle },
  { title: "Hazard Inbox", url: "/hazard-inbox", icon: IconInbox },
]

const NAV_MID: NavItem[] = [
  { title: "Emergency Response", url: "/emergency", icon: IconUrgent },
  { title: "FRMS", url: "/frms", icon: IconFileDescription },
  { title: "Meetings", url: "/meetings", icon: IconCalendarEvent },
]

const NAV_AFTER_CONTROLLED_DOCS: NavItem[] = [
  { title: "Tasks & Actions", url: "/tasks", icon: IconChecklist },
  {
    title: "Performance Reports",
    url: "/compliance/performance-reports",
    icon: IconChartBar,
  },
  { title: "AI Report Creator", url: "/ai-reports", icon: IconRobot },
  { title: "Addons", url: "/addons", icon: IconPuzzle },
]

const configurationsSubItems: {
  title: string
  url: string
  approversOnly?: boolean
  qualityOrAdminOnly?: boolean
}[] = [
  { title: "New worker", url: "/configurations/new-worker", approversOnly: true },
  { title: "User Settings", url: "/configurations" },
  {
    title: "Safety settings",
    url: "/configurations/safety-settings",
    qualityOrAdminOnly: true,
  },
  { title: "Audit Settings", url: "/configurations/audit-settings" },
  { title: "Correspondences", url: "/configurations/correspondences" },
]

const announcementSystemSubItems: {
  title: string
  url: string
  configurationsOnly?: boolean
}[] = [
  { title: "View announcements", url: "/dashboard" },
  {
    title: "Manage announcements",
    url: "/configurations/announcements",
    configurationsOnly: true,
  },
]

const controlledDocumentsSubItems: {
  title: string
  url: string
  configurationsOnly?: boolean
}[] = [
  { title: "Manuals", url: "/documents" },
  { title: "Forms", url: "/documents/forms" },
  { title: "Document Procedure", url: "/documents/document-procedure" },
  { title: "Aircraft Settings", url: "/documents/aircraft-settings", configurationsOnly: true },
]

const correspondencesSubItems = [
  { title: "Incoming Correspondences", url: "/correspondences/incoming" },
  { title: "Outgoing Correspondences", url: "/correspondences/outgoing" },
]

const safetyManagementSubItems = [{ title: "Risk Board", url: "/safety/risk-board" }]

const complianceMonitoringSubItems = [
  { title: "Audit Plan", url: "/compliance/audit-plan" },
  { title: "Checklists", url: "/compliance/checklists" },
  { title: "Findings Follow Up", url: "/compliance/findings-follow-up" },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User
  /** Audit Plan alt menüsü — yalnızca `AUDIT_PLAN_ADMIN_EMAILS` içindeki kullanıcılar */
  showAuditPlanNav?: boolean
}

export function AppSidebar({
  user,
  showAuditPlanNav = false,
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { hasUnread } = useDmInbox()
  const flushMessagesGutter =
    pathname === "/messages" || pathname?.startsWith("/messages/")
  const messagesRouteActive =
    pathname === "/messages" || pathname?.startsWith("/messages/")
  const messagesNavHighlight = messagesRouteActive || hasUnread
  const router = useRouter()

  const sidebarContentRef = React.useRef<HTMLDivElement | null>(null)

  const [configurationsOpen, setConfigurationsOpen] = React.useState(
    pathname?.startsWith("/configurations") || false
  )
  const [controlledDocumentsOpen, setControlledDocumentsOpen] = React.useState(
    pathname?.startsWith("/documents") || false
  )
  const [correspondencesOpen, setCorrespondencesOpen] = React.useState(
    pathname?.startsWith("/correspondences") || false
  )
  const [safetyManagementOpen, setSafetyManagementOpen] = React.useState(
    pathname?.startsWith("/safety") || false
  )
  const [complianceMonitoringOpen, setComplianceMonitoringOpen] = React.useState(
    pathname?.startsWith("/compliance") || false
  )
  const [announcementSystemOpen, setAnnouncementSystemOpen] = React.useState(
    pathname?.startsWith("/configurations/announcements") || false
  )

  const hasConfigurationsAccess = canAccessConfigurationsArea(user.departman)
  const canReviewRegistrations = canApproveWorkerRegistrations(user.departman)
  const canSafetyQualityPage = canAccessQualityOrAdminSettings(user.departman)
  const showConfigurationsNav =
    hasConfigurationsAccess || canReviewRegistrations || canSafetyQualityPage
  const visibleConfigurationSubItems = configurationsSubItems.filter((item) => {
    if (item.approversOnly) return canReviewRegistrations
    if (item.qualityOrAdminOnly) return canSafetyQualityPage
    return hasConfigurationsAccess
  })
  const visibleControlledDocumentsSubItems = controlledDocumentsSubItems.filter((item) => {
    if (item.configurationsOnly) return hasConfigurationsAccess
    return true
  })

  const visibleComplianceMonitoringSubItems = React.useMemo(
    () =>
      complianceMonitoringSubItems.filter((item) => {
        if (
          item.url === "/compliance/audit-plan" ||
          item.url === "/compliance/checklists" ||
          item.url === "/compliance/findings-follow-up"
        ) {
          return showAuditPlanNav
        }
        return true
      }),
    [showAuditPlanNav]
  )

  const visibleAnnouncementSystemSubItems = React.useMemo(
    () =>
      announcementSystemSubItems.filter((item) => {
        if (item.configurationsOnly) return hasConfigurationsAccess
        return true
      }),
    [hasConfigurationsAccess]
  )

  React.useEffect(() => {
    const storedConfigurations = window.localStorage.getItem(
      "bonair.sidebar.configurationsOpen"
    )
    if (storedConfigurations !== null) {
      setConfigurationsOpen(storedConfigurations === "true")
    }

    const storedCorrespondences = window.localStorage.getItem(
      "bonair.sidebar.correspondencesOpen"
    )
    if (storedCorrespondences !== null) {
      setCorrespondencesOpen(storedCorrespondences === "true")
    }

    const storedControlledDocuments = window.localStorage.getItem(
      "bonair.sidebar.controlledDocumentsOpen"
    )
    if (storedControlledDocuments !== null) {
      setControlledDocumentsOpen(storedControlledDocuments === "true")
    }

    const storedSafety = window.localStorage.getItem("bonair.sidebar.safetyManagementOpen")
    if (storedSafety !== null) {
      setSafetyManagementOpen(storedSafety === "true")
    }

    const storedCompliance = window.localStorage.getItem(
      "bonair.sidebar.complianceMonitoringOpen"
    )
    if (storedCompliance !== null) {
      setComplianceMonitoringOpen(storedCompliance === "true")
    }

    const storedAnnouncement = window.localStorage.getItem(
      "bonair.sidebar.announcementSystemOpen"
    )
    if (storedAnnouncement !== null) {
      setAnnouncementSystemOpen(storedAnnouncement === "true")
    }
  }, [])

  React.useEffect(() => {
    if (pathname?.startsWith("/configurations")) {
      setConfigurationsOpen(true)
    }
    if (pathname?.startsWith("/correspondences")) {
      setCorrespondencesOpen(true)
    }
    if (pathname?.startsWith("/documents")) {
      setControlledDocumentsOpen(true)
    }
    if (pathname?.startsWith("/safety")) {
      setSafetyManagementOpen(true)
    }
    if (pathname?.startsWith("/compliance")) {
      setComplianceMonitoringOpen(true)
    }
    if (pathname?.startsWith("/configurations/announcements")) {
      setAnnouncementSystemOpen(true)
    }
  }, [pathname])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.configurationsOpen",
      configurationsOpen ? "true" : "false"
    )
  }, [configurationsOpen])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.correspondencesOpen",
      correspondencesOpen ? "true" : "false"
    )
  }, [correspondencesOpen])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.controlledDocumentsOpen",
      controlledDocumentsOpen ? "true" : "false"
    )
  }, [controlledDocumentsOpen])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.safetyManagementOpen",
      safetyManagementOpen ? "true" : "false"
    )
  }, [safetyManagementOpen])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.complianceMonitoringOpen",
      complianceMonitoringOpen ? "true" : "false"
    )
  }, [complianceMonitoringOpen])

  React.useEffect(() => {
    window.localStorage.setItem(
      "bonair.sidebar.announcementSystemOpen",
      announcementSystemOpen ? "true" : "false"
    )
  }, [announcementSystemOpen])

  React.useEffect(() => {
    const el = sidebarContentRef.current
    if (!el) return

    const storedScroll = window.localStorage.getItem("bonair.sidebar.scrollTop")
    if (storedScroll) {
      const n = Number(storedScroll)
      if (!Number.isNaN(n)) el.scrollTop = n
    }

    const onScroll = () => {
      window.localStorage.setItem("bonair.sidebar.scrollTop", String(el.scrollTop))
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const showComplianceNav = canViewComplianceMonitoringNav(user.departman)
  const showSafetyNav = canViewSafetyManagementNav(user.departman)

  const isControlledDocumentsSubActive = (subUrl: string) => {
    if (subUrl === "/documents") return pathname === "/documents"
    return pathname === subUrl || !!pathname?.startsWith(`${subUrl}/`)
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      className={cn(flushMessagesGutter && "md:!pr-0", className)}
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/dashboard" className="flex justify-center">
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-3 shadow-md">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={45}
              className="h-auto w-auto object-contain"
              priority
            />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} className="px-2 py-2">
        <SidebarMenu>
          {NAV_TOP.map((item) => {
            const isActive =
              pathname === item.url || pathname?.startsWith(`${item.url}/`)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "h-10 rounded-lg px-3 transition-colors",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <Link href={item.url}>
                    <item.icon className="size-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          {showComplianceNav ? (
            <Collapsible
              open={complianceMonitoringOpen}
              onOpenChange={setComplianceMonitoringOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "h-10 w-full justify-between rounded-lg px-3 transition-colors",
                      pathname?.startsWith("/compliance") &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconClipboardCheck className="size-5" />
                      <span>Compliance Monitoring</span>
                    </div>
                    <IconChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        complianceMonitoringOpen && "rotate-180"
                      )}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {visibleComplianceMonitoringSubItems.map((subItem) => {
                      const isSubActive =
                        pathname === subItem.url ||
                        !!pathname?.startsWith(`${subItem.url}/`)
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className={cn(
                              "h-9 pl-9",
                              isSubActive && "bg-sidebar-accent/50 font-medium"
                            )}
                          >
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : null}

          {showSafetyNav ? (
            <Collapsible
              open={safetyManagementOpen}
              onOpenChange={setSafetyManagementOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "h-10 w-full justify-between rounded-lg px-3 transition-colors",
                      pathname?.startsWith("/safety") &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconShieldCheck className="size-5" />
                      <span>Safety Management</span>
                    </div>
                    <IconChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        safetyManagementOpen && "rotate-180"
                      )}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {safetyManagementSubItems.map((subItem) => {
                      const isSubActive =
                        subItem.url === "/safety/risk-board"
                          ? pathname === "/safety/risk-board" ||
                            pathname?.startsWith("/safety/task-board")
                          : pathname === subItem.url ||
                            !!pathname?.startsWith(`${subItem.url}/`)
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className={cn(
                              "h-9 pl-9",
                              isSubActive && "bg-sidebar-accent/50 font-medium"
                            )}
                          >
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : null}

          {NAV_MID.map((item) => {
            const isActive =
              pathname === item.url || pathname?.startsWith(`${item.url}/`)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "h-10 rounded-lg px-3 transition-colors",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <Link href={item.url}>
                    <item.icon className="size-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          <Collapsible
            open={controlledDocumentsOpen}
            onOpenChange={setControlledDocumentsOpen}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    "h-10 px-3 rounded-lg transition-colors w-full justify-between",
                    pathname?.startsWith("/documents") &&
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <IconFileDescription className="size-5" />
                    <span>Controlled Documents</span>
                  </div>
                  <IconChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      controlledDocumentsOpen && "rotate-180"
                    )}
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {visibleControlledDocumentsSubItems.map((subItem) => {
                    const isSubActive = isControlledDocumentsSubActive(subItem.url)
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          className={cn(
                            "h-9 pl-9",
                            isSubActive && "bg-sidebar-accent/50 font-medium"
                          )}
                        >
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {NAV_AFTER_CONTROLLED_DOCS.map((item) => {
            const isActive =
              pathname === item.url || pathname?.startsWith(`${item.url}/`)
            const announcementSystemNavActive =
              pathname?.startsWith("/configurations/announcements") ||
              pathname === "/dashboard"

            return (
              <React.Fragment key={item.title}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 rounded-lg px-3 transition-colors",
                      isActive &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon className="size-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {item.title === "Performance Reports" ? (
                  <Collapsible
                    open={announcementSystemOpen}
                    onOpenChange={setAnnouncementSystemOpen}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className={cn(
                            "h-10 w-full justify-between rounded-lg px-3 transition-colors",
                            announcementSystemNavActive &&
                              "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <IconSpeakerphone className="size-5" />
                            <span>Announcement System</span>
                          </div>
                          <IconChevronDown
                            className={cn(
                              "size-4 transition-transform duration-200",
                              announcementSystemOpen && "rotate-180"
                            )}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {visibleAnnouncementSystemSubItems.map((subItem) => {
                            const isSubActive =
                              subItem.url === "/dashboard"
                                ? pathname === "/dashboard" ||
                                  pathname === "/dashboard/"
                                : pathname === subItem.url ||
                                  !!pathname?.startsWith(`${subItem.url}/`)
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  className={cn(
                                    "h-9 pl-9",
                                    isSubActive &&
                                      "bg-sidebar-accent/50 font-medium"
                                  )}
                                >
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : null}
              </React.Fragment>
            )
          })}

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                "h-10 px-3 rounded-lg transition-colors",
                messagesNavHighlight &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )}
            >
              <Link href="/messages">
                <IconMessage className="size-5" />
                <span>Messages</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {showConfigurationsNav && (
            <Collapsible
              open={configurationsOpen}
              onOpenChange={setConfigurationsOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "h-10 px-3 rounded-lg transition-colors w-full justify-between",
                      pathname?.startsWith("/configurations") && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconSettings className="size-5" />
                      <span>Configurations</span>
                    </div>
                    <IconChevronDown className={cn(
                      "size-4 transition-transform duration-200",
                      configurationsOpen && "rotate-180"
                    )} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {visibleConfigurationSubItems.map((subItem) => {
                      const isSubActive =
                        pathname === subItem.url ||
                        !!pathname?.startsWith(`${subItem.url}/`)
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className={cn(
                              "h-9 pl-9",
                              isSubActive && "bg-sidebar-accent/50 font-medium"
                            )}
                          >
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          {hasConfigurationsAccess && (
            <Collapsible
              open={correspondencesOpen}
              onOpenChange={setCorrespondencesOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "h-10 px-3 rounded-lg transition-colors w-full justify-between",
                      pathname?.startsWith("/correspondences") && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconMail className="size-5" />
                      <span>Correspondences</span>
                    </div>
                    <IconChevronDown className={cn(
                      "size-4 transition-transform duration-200",
                      correspondencesOpen && "rotate-180"
                    )} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {correspondencesSubItems.map((subItem) => {
                      const isSubActive = pathname === subItem.url
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            className={cn(
                              "h-9 pl-9",
                              isSubActive && "bg-sidebar-accent/50 font-medium"
                            )}
                          >
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                "h-10 px-3 rounded-lg transition-colors",
                pathname === "/account" && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )}
            >
              <Link href="/account">
                <IconUser className="size-5" />
                <span>Account Managing</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await signOut({ redirect: false })
                router.push("/login")
                router.refresh()
              }}
              className="h-10 px-3 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <IconLogout className="size-5" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
