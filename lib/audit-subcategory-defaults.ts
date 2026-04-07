/**
 * Varsayılan alt kategori isimleri — üst kategori adıyla eşleşir (Audit Settings’teki isimlerle).
 * `ensureAuditSubCategoryTypes` ilk çalışmada ekler.
 */
export const DEFAULT_SUBCATEGORY_NAMES_BY_CATEGORY: Record<string, string[]> = {
  "BONAIR Part 145": ["Line maintenance", "Base maintenance"],
  "DGCA AUDIT": ["Planned audit", "Follow-up"],
  External: ["Regulator", "Certification body"],
  Internal: ["Ground operations", "Training", "Maintenance"],
  SACA: ["Operations", "Documentation"],
  SAFA: ["Ramp", "Terminal"],
  "Safety Brifing and Demonstration Process Audit": ["Briefing", "Demonstration"],
  "Customers/Authorities": ["Customer", "Authority"],
}
