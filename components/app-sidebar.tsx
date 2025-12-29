"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  IconAlertTriangle,
  IconBell,
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
  IconPaperclip,
  IconPlane,
  IconPuzzle,
  IconRobot,
  IconSettings,
  IconShieldCheck,
  IconSpeakerphone,
  IconUrgent,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
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
  const [configurationsOpen, setConfigurationsOpen] = React.useState(
    pathname?.startsWith("/configurations") || false
  )
  const [correspondencesOpen, setCorrespondencesOpen] = React.useState(
    pathname?.startsWith("/correspondences") || false
  )

  // Check if user has access to Configurations (Human Resources or Quality departments)
  const hasConfigurationsAccess = user.departman === "Human Resources" || user.departman === "Quality"
  
  // Debug: Log user department to console
  React.useEffect(() => {
    console.log("User department:", user.departman)
    console.log("Has configurations access:", hasConfigurationsAccess)
  }, [user.departman, hasConfigurationsAccess])

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

      <SidebarContent className="px-2 py-2">
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

          {/* Configurations with submenu - Only visible for Human Resources or Quality */}
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

          {/* Correspondences with submenu */}
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

          {/* Account Managing */}
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
