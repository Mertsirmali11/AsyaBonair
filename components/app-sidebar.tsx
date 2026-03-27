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
  IconPuzzle,
  IconRobot,
  IconSettings,
  IconShieldCheck,
  IconSpeakerphone,
  IconUrgent,
  IconUser,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { canAccessConfigurationsArea } from "@/lib/department-access"
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

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Report Hazard", url: "/report-hazard", icon: IconAlertTriangle },
  { title: "Hazard Inbox", url: "/hazard-inbox", icon: IconInbox },
  { title: "Compliance Monitoring", url: "/compliance", icon: IconClipboardCheck },
  { title: "Safety Management", url: "/safety", icon: IconShieldCheck },
  { title: "Emergency Response", url: "/emergency", icon: IconUrgent },
  { title: "FRMS", url: "/frms", icon: IconFileDescription },
  { title: "Controlled Documents", url: "/documents", icon: IconFileDescription },
  { title: "Tasks & Actions", url: "/tasks", icon: IconChecklist },
  { title: "Meetings", url: "/meetings", icon: IconCalendarEvent },
  { title: "Performance Reports", url: "/reports", icon: IconChartBar },
  { title: "Announcement System", url: "/announcements", icon: IconSpeakerphone },
  { title: "AI Report Creator", url: "/ai-reports", icon: IconRobot },
  { title: "Addons", url: "/addons", icon: IconPuzzle },
]

const configurationsSubItems = [
  { title: "User Settings", url: "/configurations" },
  { title: "Pilot Settings", url: "/configurations/pilot-settings" },
  { title: "Aircraft Settings", url: "/configurations/aircraft-settings" },
  { title: "Announcements", url: "/configurations/announcements" },
]

const correspondencesSubItems = [
  { title: "Incoming Correspondences", url: "/correspondences/incoming" },
  { title: "Outgoing Correspondences", url: "/correspondences/outgoing" },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const sidebarContentRef = React.useRef<HTMLDivElement | null>(null)

  const [configurationsOpen, setConfigurationsOpen] = React.useState(
    pathname?.startsWith("/configurations") || false
  )
  const [correspondencesOpen, setCorrespondencesOpen] = React.useState(
    pathname?.startsWith("/correspondences") || false
  )

  const hasConfigurationsAccess = canAccessConfigurationsArea(user.departman)

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
  }, [])

  React.useEffect(() => {
    if (pathname?.startsWith("/configurations")) {
      setConfigurationsOpen(true)
    }
    if (pathname?.startsWith("/correspondences")) {
      setCorrespondencesOpen(true)
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

  return (
    <Sidebar collapsible="offcanvas" {...props}>
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
          {menuItems.map((item) => {
            const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "h-10 px-3 rounded-lg transition-colors",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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

          {hasConfigurationsAccess && (
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
                    {configurationsSubItems.map((subItem) => {
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
