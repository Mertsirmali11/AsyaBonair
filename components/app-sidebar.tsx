"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCalendarOff,
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
  // IconShieldCheck, // Safety Management — ileride
  IconSpeakerphone,
  IconTicket,
  IconUrgent,
  IconUser,
} from "@tabler/icons-react"

import { useDmInbox } from "@/components/dm-inbox-provider"
import { useLanguage } from "@/lib/i18n/context"
import { LanguageToggle } from "@/components/language-toggle"
import { cn } from "@/lib/utils"
import type { ResolvedDepartmentPermissions } from "@/lib/department-permissions-resolve"
import { getSidebarNavVisibility } from "@/lib/sidebar-nav-visibility"
// import { canViewSafetyManagementNav } from "@/lib/sidebar-nav-access" // Safety Management — ileride
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

// Nav arrays are built inside the component using t.nav.* translations

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User
  /** Audit Plan alt menüsü — yalnızca `AUDIT_PLAN_ADMIN_EMAILS` içindeki kullanıcılar */
  showAuditPlanNav?: boolean
  departmentPermissions?: ResolvedDepartmentPermissions | null
}

export function AppSidebar({
  user,
  showAuditPlanNav = false,
  departmentPermissions: departmentPermissionsFromServer = null,
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { hasUnread } = useDmInbox()
  const { t } = useLanguage()

  // ── Translated nav arrays (rebuilt on locale change) ──────────────────────
  const NAV_TOP: NavItem[] = [
    { title: t.nav.dashboard, url: "/dashboard", icon: IconDashboard },
    { title: t.nav.supportTicket, url: "/support-tickets", icon: IconTicket },
    { title: t.nav.reportHazard, url: "/report-hazard", icon: IconAlertTriangle },
    { title: t.nav.hazardInbox, url: "/hazard-inbox", icon: IconInbox },
  ]

  const NAV_MID: NavItem[] = [
    // { title: t.nav.emergencyResponse, url: "/emergency", icon: IconUrgent }, // sayfa yok → 404
    // { title: t.nav.frms, url: "/frms", icon: IconFileDescription }, // sayfa yok → 404
    { title: t.nav.meetings, url: "/meetings", icon: IconCalendarEvent },
  ]

  const NAV_AFTER_CONTROLLED_DOCS: NavItem[] = [
    { title: t.nav.tasksActions, url: "/tasks", icon: IconChecklist },
    { title: t.nav.performanceReports, url: "/compliance/performance-reports", icon: IconChartBar },
    { title: t.nav.aiReportCreator, url: "/ai-reports", icon: IconRobot },
    { title: t.nav.leaveRequests, url: "/leave-requests", icon: IconCalendarOff },
    { title: t.nav.companyStatusBoard, url: "/company-status", icon: IconBuildingSkyscraper },
    // { title: t.nav.addons, url: "/addons", icon: IconPuzzle }, // sayfa yok → 404
  ]

  type ConfigurationNavSubItem = {
    title: string
    url: string
    matchExact?: boolean
    approversOnly?: boolean
    /** configurations_area yetkisi gerekir (User Settings, Departmanlar, …) */
    requiresConfigurations?: boolean
    /** compliance_monitoring yetkisi gerekir */
    requiresCompliance?: boolean
  }

  const configurationsSubItems: ConfigurationNavSubItem[] = [
    // { title: t.nav.newWorker, url: "/configurations/new-worker", approversOnly: true }, // ileride
    {
      title: t.nav.userSettings,
      url: "/configurations",
      matchExact: true,
      requiresConfigurations: true,
    },
    {
      title: t.nav.departments,
      url: "/configurations/departments",
      requiresConfigurations: true,
    },
    {
      title: t.nav.authorization,
      url: "/configurations/department-permissions",
      requiresConfigurations: true,
    },
    {
      title: t.nav.auditSettings,
      url: "/configurations/audit-settings",
      requiresConfigurations: true,
    },
    // {
    //   title: t.nav.correspondences,
    //   url: "/configurations/correspondences",
    //   requiresConfigurations: true,
    // },
  ]

  const announcementSystemSubItems = [
    { title: t.nav.viewAnnouncements, url: "/dashboard" },
    { title: t.nav.manageAnnouncements, url: "/configurations/announcements", configurationsOnly: true },
  ]

  type DocumentNavSubItem = {
    title: string
    url: string
    configurationsOnly?: boolean
  }

  const controlledDocumentsSubItems: DocumentNavSubItem[] = [
    { title: t.nav.manuals, url: "/documents" },
    { title: t.nav.forms, url: "/documents/forms" },
    { title: t.nav.documentProcedure, url: "/documents/document-procedure" },
    { title: t.nav.aircraftSettings, url: "/documents/aircraft-settings", configurationsOnly: true },
  ]

  const correspondencesSubItems = [
    { title: t.nav.incomingCorrespondences, url: "/correspondences/incoming" },
    { title: t.nav.outgoingCorrespondences, url: "/correspondences/outgoing" },
  ]

  // Safety Management — menü şimdilik gizli (ileride)
  // const safetyManagementSubItems = [
  //   { title: t.nav.riskBoard, url: "/safety/risk-board" },
  // ]

  const complianceMonitoringSubItems = [
    { title: t.nav.auditPlan, url: "/compliance/audit-plan" },
    { title: t.nav.checklists, url: "/compliance/checklists" },
    { title: t.nav.findingsFollowUp, url: "/compliance/findings-follow-up" },
    { title: t.nav.shgmMevzuat, url: "/compliance/shgm-mevzuat" },
    { title: t.nav.trainingTracking, url: "/compliance/training" },
    { title: t.nav.safaScore, url: "/compliance/safa" },
  ]
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

  const [deptPermissions, setDeptPermissions] =
    React.useState<ResolvedDepartmentPermissions | null>(
      departmentPermissionsFromServer
    )

  React.useEffect(() => {
    setDeptPermissions(departmentPermissionsFromServer)
  }, [departmentPermissionsFromServer])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/me/department-permissions", {
          cache: "no-store",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled || !data.permissions) return
        setDeptPermissions(data.permissions as ResolvedDepartmentPermissions)
      } catch {
        /* sunucudan gelen izinler yeterli */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user.departman])

  const navVisibility = React.useMemo(
    () =>
      getSidebarNavVisibility({
        departman: user.departman,
        permissions: deptPermissions,
        showAuditPlanNav,
      }),
    [user.departman, deptPermissions, showAuditPlanNav]
  )

  const visibleConfigurationSubItems = configurationsSubItems.filter((item) => {
    if (item.approversOnly) return navVisibility.workerApproval
    if (item.requiresCompliance) return navVisibility.compliance
    return navVisibility.configurations
  })

  const visibleControlledDocumentsSubItems = controlledDocumentsSubItems.filter(
    (item) => {
      if (!navVisibility.showControlledDocumentsNav) return false
      if (item.configurationsOnly) return navVisibility.showAircraftSettingsNav
      return true
    }
  )

  const visibleComplianceMonitoringSubItems = complianceMonitoringSubItems.filter(
    (item) => {
      if (item.url === "/compliance/audit-plan") return showAuditPlanNav
      if (item.url === "/compliance/findings-follow-up") return true // Herkese görünür
      return navVisibility.compliance
    }
  )

  const visibleAnnouncementSystemSubItems = announcementSystemSubItems.filter(
    (item) => {
      if (item.configurationsOnly) return navVisibility.showAnnouncementManageNav
      return true
    }
  )

  const navMidVisible = NAV_MID.filter((item) => {
    if (item.url === "/meetings") return navVisibility.meetings
    return true
  })

  const navAfterDocsVisible = NAV_AFTER_CONTROLLED_DOCS.filter((item) => {
    if (item.url === "/tasks") return navVisibility.tasks
    if (item.url === "/compliance/performance-reports") {
      return navVisibility.showPerformanceReportsNav
    }
    if (item.url === "/ai-reports") return navVisibility.aiReports
    if (item.url === "/leave-requests") return navVisibility.leaveRequests
    if (item.url === "/company-status") return navVisibility.companyStatus
    return true
  })

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

  const showComplianceNav = visibleComplianceMonitoringSubItems.length > 0
  // const showSafetyNav = resolveDeptPermission(
  //   DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT,
  //   canViewSafetyManagementNav(user.departman)
  // )

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
              src="/logo-bonjour.png"
              alt="Bonjour Logo"
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
                      <span>{t.nav.complianceMonitoring}</span>
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

          {/* Safety Management — ileride etkinleştir
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
                      <span>{t.nav.safetyManagement}</span>
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
          */}

          {navMidVisible.map((item) => {
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

          {visibleControlledDocumentsSubItems.length > 0 ? (
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
                      <span>{t.nav.controlledDocuments}</span>
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
          ) : null}

          {navAfterDocsVisible.map((item) => {
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

                {item.url === "/compliance/performance-reports" &&
                visibleAnnouncementSystemSubItems.length > 0 ? (
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
                            <span>{t.nav.announcementSystem}</span>
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
                <span>{t.nav.messages}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {navVisibility.showConfigurationsNav &&
          visibleConfigurationSubItems.length > 0 ? (
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
                      <span>{t.nav.configurations}</span>
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
                      const path = pathname ?? ""
                      const isSubActive = subItem.matchExact
                        ? path === subItem.url || path === `${subItem.url}/`
                        : path === subItem.url || path.startsWith(`${subItem.url}/`)
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

          {navVisibility.showCorrespondencesNav ? (
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
                      <span>{t.nav.correspondences}</span>
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
          ) : null}

          {/* Account sayfası yok → 404 — aktif edilince aşağıdaki satırları aç
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
                <span>{t.common.account}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          */}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
        {/* <div className="flex justify-center px-1 py-1">
          <LanguageToggle className="w-full justify-center" />
        </div> */}
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
              <span>{t.common.logOut}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
