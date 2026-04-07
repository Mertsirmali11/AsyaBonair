import { auth } from "@/auth"
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
  const session = await auth()
  const actorName = session?.user?.name?.trim() || undefined

  return (
    <>
      <SetWorkspacePageTitle title="Risk assessment" />
      <TaskBoardView riskTitle={riskTitle ?? undefined} actorName={actorName} />
    </>
  )
}
