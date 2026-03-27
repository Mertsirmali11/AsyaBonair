import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MessagesClient } from "./messages-client"

export default async function MessagesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const currentCalisanId = Number.parseInt(session.user?.id ?? "", 10)
  if (Number.isNaN(currentCalisanId)) redirect("/login")

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user} headerTitle="Messages">
      <Suspense
        fallback={
          <div className="text-muted-foreground flex min-h-[min(400px,50dvh)] flex-1 items-center justify-center text-sm">
            Yükleniyor…
          </div>
        }
      >
        <MessagesClient
          currentCalisanId={currentCalisanId}
          currentUserName={session.user?.name ?? null}
          currentUserAvatarUrl={session.user?.image ?? null}
        />
      </Suspense>
    </DashboardLayout>
  )
}
