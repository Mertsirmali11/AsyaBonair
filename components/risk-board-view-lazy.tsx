"use client"

import dynamic from "next/dynamic"

const RiskBoardView = dynamic(
  () => import("@/components/risk-board-view").then((m) => m.RiskBoardView),
  { ssr: false }
)

export function RiskBoardViewLazy() {
  return <RiskBoardView />
}
