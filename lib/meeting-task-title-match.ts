/** Match meeting task titles to barrier text (normalized comparison). */

export type MeetingTaskMatchRow = {
  id: number
  title: string
  status: string
  dueDate: string | null
  assigneeId: number | null
  meetingId: number | null
  assignee: { isim: string | null; soyisim: string | null } | null
  meeting?: { id: number; meetingNo: string; title: string } | null
}

export function normalizeMeetingTaskTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export function findTaskByBarrierTitle(
  tasks: MeetingTaskMatchRow[],
  barrierTitle: string
): MeetingTaskMatchRow | null {
  const n = normalizeMeetingTaskTitle(barrierTitle)
  if (!n) return null
  return tasks.find((t) => normalizeMeetingTaskTitle(t.title) === n) ?? null
}

export type BarrierRecordStatusLabel =
  | "Pending for Assignment"
  | "In Progress"
  | "Current"

export function barrierStatusFromTask(
  task: MeetingTaskMatchRow | null
): BarrierRecordStatusLabel {
  if (!task) return "Pending for Assignment"
  const st = task.status.trim()
  if (st === "Completed" || st.toLowerCase() === "approved") return "Current"
  if (task.assigneeId != null || st === "In Progress") return "In Progress"
  return "Pending for Assignment"
}

export function formatAssigneeName(
  a: { isim: string | null; soyisim: string | null } | null
): string {
  if (!a) return "—"
  const n = `${a.isim ?? ""} ${a.soyisim ?? ""}`.trim()
  return n || "—"
}
