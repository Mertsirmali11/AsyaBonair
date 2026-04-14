import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { RiskBoardViewLazy } from "@/components/risk-board-view-lazy"

export default function SafetyRiskBoardPage() {
  return (
    <>
      <SetWorkspacePageTitle title="Risk Board" />
      <RiskBoardViewLazy />
    </>
  )
}
