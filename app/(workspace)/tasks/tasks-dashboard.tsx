"use client"

import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { TasksClient } from "./tasks-client"

export function TasksDashboard() {
  return (
    <>
      <SetWorkspacePageTitle title="Tasks & Actions" />
      <TasksClient />
    </>
  )
}
