import dynamic from "next/dynamic"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

const RiskBoardView = dynamic(
  () => import("@/components/risk-board-view").then((m) => m.RiskBoardView),
  { ssr: false }
)

export default function SafetyRiskBoardPage() {
  return (
    <>
      <SetWorkspacePageTitle title="Risk Board" />
      <RiskBoardView />
    </>
  )
}
