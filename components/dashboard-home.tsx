"use client"

import type { z } from "zod"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DataTable, schema } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

type DashboardUser = {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

type DashboardHomeProps = {
  user: DashboardUser
  tableData: z.infer<typeof schema>[]
}

export function DashboardHome({ user, tableData }: DashboardHomeProps) {
  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={tableData} />
      </div>
    </DashboardLayout>
  )
}
