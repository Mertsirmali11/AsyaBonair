import { isAdminDepartment } from "@/lib/department-access"

export function canEditDocumentProcedure(
  departman: string | null | undefined
): boolean {
  return departman === "Quality" || isAdminDepartment(departman)
}
