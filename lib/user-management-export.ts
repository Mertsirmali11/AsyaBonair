"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

import { sanitizeFilenamePart } from "@/lib/audit-checklist-export-lines"

export function downloadUserSettingsTablePdf(
  headers: string[],
  bodyRows: string[][]
): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })
  doc.setFontSize(11)
  doc.text("User settings", 14, 12)
  doc.setFontSize(8)
  doc.text(`Exported ${new Date().toLocaleString()}`, 14, 17)

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: bodyRows,
    styles: { fontSize: 6, cellPadding: 0.8, overflow: "linebreak" },
    headStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  })

  const base = sanitizeFilenamePart(`user-settings-${Date.now()}`)
  doc.save(`${base}.pdf`)
}

export function downloadUserSettingsTableXlsx(
  headers: string[],
  bodyRows: string[][]
): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...bodyRows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, "Users")
  const base = sanitizeFilenamePart(`user-settings-${Date.now()}`)
  XLSX.writeFile(wb, `${base}.xlsx`)
}
