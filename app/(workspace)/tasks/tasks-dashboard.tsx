"use client"

import { NavPageTitle } from "@/components/nav-page-title"
import { TasksClient } from "./tasks-client"

export function TasksDashboard() {
  return (
    <>
      <NavPageTitle navKey="tasksActions" />
      <TasksClient />
    </>
  )
}
