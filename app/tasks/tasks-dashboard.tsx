"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { TasksClient } from "./tasks-client"

type TasksUser = {
  name: string
  email: string
  avatar: string
  departman?: string | null
}

export function TasksDashboard({ user }: { user: TasksUser }) {
  return (
    <DashboardLayout user={user} headerTitle="Tasks & Actions">
      <TasksClient />
    </DashboardLayout>
  )
}
