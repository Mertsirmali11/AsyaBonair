import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { PlannerBoardClient } from "@/components/planner/planner-board-client"

type Props = { params: Promise<{ planId: string }> }

export default async function PlannerBoardPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { planId } = await params
  const id = Number(planId)
  if (!Number.isInteger(id) || id < 1) redirect("/planner")

  return <PlannerBoardClient planId={id} />
}
