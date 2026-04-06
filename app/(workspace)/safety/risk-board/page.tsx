import { RiskBoardView } from "@/components/risk-board-view"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default function SafetyRiskBoardPage() {
  return (
    <>
      <SetWorkspacePageTitle title="Risk Board" />
      <RiskBoardView />
    </>
  )
}
