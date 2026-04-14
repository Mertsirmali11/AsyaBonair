"use client"

import dynamic from "next/dynamic"

const TaskBoardView = dynamic(
  () => import("@/components/task-board-view").then((m) => m.TaskBoardView),
  { ssr: false }
)

export function TaskBoardViewLazy({
  riskTitle,
  actorName,
}: {
  riskTitle?: string
  actorName?: string
}) {
  return <TaskBoardView riskTitle={riskTitle} actorName={actorName} />
}
