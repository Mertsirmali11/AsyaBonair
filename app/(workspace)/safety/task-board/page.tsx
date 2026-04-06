import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { TaskBoardView } from "@/components/task-board-view"

type Props = {
  searchParams: Promise<{ title?: string }>
}

export default async function SafetyTaskBoardPage({ searchParams }: Props) {
  const q = await searchParams
  const raw = q.title
  const riskTitle =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null

  return (
    <>
      <SetWorkspacePageTitle title="Task Board" />
      <TaskBoardView riskTitle={riskTitle ?? undefined} />
    </>
  )
}
