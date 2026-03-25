export function canAccessConfigurationsArea(
  departman: string | null | undefined
): boolean {
  return departman === "Human Resources" || departman === "Quality"
}
