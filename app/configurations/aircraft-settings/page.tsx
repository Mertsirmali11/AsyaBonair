import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AircraftSettingsTable, type AircraftSettingRow } from "@/components/aircraft-settings-table"

const demoRows: AircraftSettingRow[] = [
  {
    id: "1",
    name: "Boeing 737-800",
    code: "B738",
    pilot1: "Kerem Yıldız",
    pilot2: "Seda Aksoy",
    date1: "2026-03-17",
    date2: "2026-03-18",
    departure: "IST",
    arrival: "ESB",
  },
  {
    id: "2",
    name: "Airbus A320",
    code: "A320",
    pilot1: "Emre Şahin",
    pilot2: "Buse Karaca",
    date1: "2026-03-19",
    date2: "2026-03-20",
    departure: "SAW",
    arrival: "ADB",
  },
  {
    id: "3",
    name: "Boeing 737 MAX 8",
    code: "B38M",
    pilot1: "Onur Çelik",
    pilot2: "Seda Aksoy",
    date1: "2026-03-21",
    date2: "2026-03-22",
    departure: "ADB",
    arrival: "IST",
  },
]

export default async function AircraftSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const userDepartman = session.user?.departman
  if (userDepartman !== "Human Resources" && userDepartman !== "Quality") {
    redirect("/dashboard")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-6 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Aircraft Settings</h2>
          </div>

          <AircraftSettingsTable data={demoRows} />
        </div>
      </div>
    </DashboardLayout>
  )
}

