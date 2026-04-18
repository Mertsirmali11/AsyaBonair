import Link from "next/link"
import { BarChart2, BookOpen, ClipboardList, FileCheck } from "lucide-react"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

const cards = [
  {
    href: "/compliance/audit-plan",
    icon: <ClipboardList className="size-6 text-blue-600" />,
    title: "Audit Plan",
    description: "Denetim planlarını oluşturun, takip edin ve yönetin.",
  },
  {
    href: "/compliance/checklists",
    icon: <FileCheck className="size-6 text-emerald-600" />,
    title: "Checklists",
    description: "Denetim checklist şablonlarını yönetin.",
  },
  {
    href: "/compliance/findings-follow-up",
    icon: <BookOpen className="size-6 text-amber-600" />,
    title: "Findings Follow Up",
    description: "Denetimlerde tespit edilen bulgular, CPA ve kök neden analizi.",
  },
  {
    href: "/compliance/performance-reports",
    icon: <BarChart2 className="size-6 text-indigo-600" />,
    title: "Performance Reports",
    description: "Son 3 yılın denetim, bulgu ve hazard raporlarına dayalı performans özeti.",
  },
]

export default function ComplianceMonitoringPage() {
  return (
    <>
      <SetWorkspacePageTitle title="Compliance Monitoring" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Compliance Monitoring</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-card hover:border-primary/50 flex flex-col gap-3 rounded-lg border p-5 shadow-sm transition-colors"
            >
              <div className="flex items-center gap-3">
                {card.icon}
                <h2 className="font-semibold">{card.title}</h2>
              </div>
              <p className="text-muted-foreground text-sm">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
