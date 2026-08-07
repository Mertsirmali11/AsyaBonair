import { NavPageTitle } from "@/components/nav-page-title"
import { RiskBoardViewLazy } from "@/components/risk-board-view-lazy"

export default function SafetyRiskBoardPage() {
  return (
    <>
      <NavPageTitle navKey="riskBoard" />
      <RiskBoardViewLazy />
    </>
  )
}
