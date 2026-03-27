import { Separator } from "@/components/ui/separator"
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

export function SiteHeader({ user, title = "Documents" }: SiteHeaderProps) {
  const initials = getInitials(user?.name)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
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
