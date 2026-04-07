export type RiskStatusTone = "awaiting" | "mitigation" | "monitored"

export type RiskBoardSeedRow = {
  id: string
  riskNo: string
  date: string
  title: string
  titleDot?: "amber" | "red" | "green" | null
  initial: string
  final: string
  field: string
  threads: string
  threadsHighlight?: boolean
  status: string
  statusTone: RiskStatusTone
}

export const RISK_BOARD_SEED_ROWS: RiskBoardSeedRow[] = [
  {
    id: "1",
    riskNo: "BON-SR-1620",
    date: "2026-03-11",
    title: "test2",
    titleDot: "amber",
    initial: "Not Determined",
    final: "Not Determined",
    field: "Aircraft Audit",
    threads: "No special actions required",
    status: "Awaiting Assessment",
    statusTone: "awaiting",
  },
  {
    id: "2",
    riskNo: "BON-SR-1621",
    date: "2026-03-10",
    title: "Wings System Error (Experience Logbooks)",
    titleDot: "red",
    initial: "2C",
    final: "2C",
    field: "Flight Operation Dept",
    threads: "No special actions required",
    status: "Awaiting Mitigation",
    statusTone: "mitigation",
  },
  {
    id: "3",
    riskNo: "BON-SR-1618",
    date: "2026-03-09",
    title: "TC-IHY Right Flap Trailing Edge Damage",
    titleDot: "green",
    initial: "3C",
    final: "1E",
    field: "Performance / EFB",
    threads: "Needs Assessment",
    threadsHighlight: true,
    status: "To be Monitored",
    statusTone: "monitored",
  },
  {
    id: "4",
    riskNo: "BON-SR-1615",
    date: "2026-03-08",
    title: "Tools not returned on time or left uncontrolled",
    initial: "4C",
    final: "2D",
    field: "Maintenance",
    threads: "No special actions required",
    status: "Awaiting Assessment",
    statusTone: "awaiting",
  },
]
