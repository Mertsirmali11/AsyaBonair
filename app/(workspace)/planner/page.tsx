import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { PlannerPlansClient } from "@/components/planner/planner-plans-client"

export default async function PlannerPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <PlannerPlansClient />
}
