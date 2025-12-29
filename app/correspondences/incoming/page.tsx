import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { IncomingPaperForm } from "@/components/incoming-paper-form"
import Image from "next/image"

export default async function IncomingCorrespondencesPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user} headerTitle="Incoming Correspondences">
      <div className="flex flex-1 flex-col p-6">
        {/* Header with Logo */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
            <Image
              src="/logo.png"
              alt="Bonair Logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-lg font-medium text-muted-foreground">
            Incoming Correspondences
          </h1>
        </div>
        <IncomingPaperForm userId={session.user?.id || ""} />
      </div>
    </DashboardLayout>
  )
}

