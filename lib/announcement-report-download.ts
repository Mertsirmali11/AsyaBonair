"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

import { formatDateTimeIstanbul } from "@/lib/date-format"
import { sanitizeFilenamePart } from "@/lib/audit-checklist-export-lines"

export type AnnouncementReportStats = {
  totalStaff: number
  acknowledgedCount: number
  acknowledged: Array<{
    calisanId: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    email: string
    acknowledgedAt: string
  }>
  notAcknowledged: Array<{
    id: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    email: string
  }>
}

export type AnnouncementReportPayload = {
  id: number
  title: string
  content: string
  createdAt: string
  creator: {
    isim: string | null
    soyisim: string | null
    departman: string | null
  } | null
  stats: AnnouncementReportStats
}

function displayName(
  isim: string | null,
  soyisim: string | null,
  fallback: string
): string {
  const n = [isim, soyisim].filter(Boolean).join(" ").trim()
  return n || fallback
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  margin: number,
  startY: number,
  maxWidthMm: number,
  lineMm: number
): number {
  const lines = doc.splitTextToSize(text, maxWidthMm)
  let y = startY
  for (const line of lines) {
    if (y > 285) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += lineMm
  }
  return y
}

export function downloadAnnouncementReportPdf(payload: AnnouncementReportPayload): void {
  const { title, content, createdAt, creator, stats } = payload
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 14
  let y = 16

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("Announcement report", margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  const titleLines = doc.splitTextToSize(title, 182)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 5 + 2

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Published: ${formatDateTimeIstanbul(createdAt)}`, margin, y)
  y += 4
  if (creator) {
    doc.text(
      `Author: ${displayName(creator.isim, creator.soyisim, "—")}${
        creator.departman ? ` · ${creator.departman}` : ""
      }`,
      margin,
      y
    )
    y += 4
  }
  doc.text(
    `Acknowledged: ${stats.acknowledgedCount} / ${stats.totalStaff} staff`,
    margin,
    y
  )
  y += 6

  doc.setFont("helvetica", "bold")
  doc.text("Content", margin, y)
  y += 4
  doc.setFont("helvetica", "normal")
  y = addWrappedText(doc, content || "—", margin, y, 182, 4) + 4

  const ackBody = stats.acknowledged.map((r) => [
    displayName(r.isim, r.soyisim, `#${r.calisanId}`),
    r.departman ?? "—",
    r.email,
    formatDateTimeIstanbul(r.acknowledgedAt),
  ])
  autoTable(doc, {
    startY: y,
    head: [["Name", "Department", "Email", "Acknowledged at"]],
    body: ackBody.length ? ackBody : [["—", "—", "—", "No acknowledgments yet"]],
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  })

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  y = (docWithTable.lastAutoTable?.finalY ?? y) + 8
  if (y > 240) {
    doc.addPage()
    y = margin
  }

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Not yet acknowledged", margin, y)
  y += 4
  doc.setFont("helvetica", "normal")

  const pendingBody = stats.notAcknowledged.map((r) => [
    displayName(r.isim, r.soyisim, `#${r.id}`),
    r.departman ?? "—",
    r.email,
  ])
  autoTable(doc, {
    startY: y,
    head: [["Name", "Department", "Email"]],
    body: pendingBody.length ? pendingBody : [["—", "—", "Everyone has acknowledged"]],
    styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  })

  const base = sanitizeFilenamePart(`announcement-${payload.id}-${title}`)
  doc.save(`${base}.pdf`)
}

export function downloadAnnouncementReportXlsx(payload: AnnouncementReportPayload): void {
  const { title, content, createdAt, creator, stats } = payload
  const wb = XLSX.utils.book_new()

  const summaryRows: (string | number)[][] = [
    ["Announcement report"],
    [],
    ["Title", title],
    ["Published", formatDateTimeIstanbul(createdAt)],
    [
      "Author",
      creator
        ? `${displayName(creator.isim, creator.soyisim, "—")}${
            creator.departman ? ` (${creator.departman})` : ""
          }`
        : "—",
    ],
    ["Total staff", stats.totalStaff],
    ["Acknowledged count", stats.acknowledgedCount],
    ["Not yet acknowledged", stats.notAcknowledged.length],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary["!cols"] = [{ wch: 22 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")

  const contentRows = [["Announcement content"], [content || "—"]]
  const wsContent = XLSX.utils.aoa_to_sheet(contentRows)
  wsContent["!cols"] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(wb, wsContent, "Content")

  const ackHead = [["Name", "Department", "Email", "Acknowledged at (Istanbul)"]]
  const ackData = stats.acknowledged.map((r) => [
    displayName(r.isim, r.soyisim, `#${r.calisanId}`),
    r.departman ?? "",
    r.email,
    formatDateTimeIstanbul(r.acknowledgedAt),
  ])
  const wsAck = XLSX.utils.aoa_to_sheet([...ackHead, ...ackData])
  wsAck["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 36 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, wsAck, "Acknowledged")

  const pendHead = [["Name", "Department", "Email"]]
  const pendData = stats.notAcknowledged.map((r) => [
    displayName(r.isim, r.soyisim, `#${r.id}`),
    r.departman ?? "",
    r.email,
  ])
  const wsPend = XLSX.utils.aoa_to_sheet([...pendHead, ...pendData])
  wsPend["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(wb, wsPend, "Not acknowledged")

  const base = sanitizeFilenamePart(`announcement-${payload.id}-${title}`)
  XLSX.writeFile(wb, `${base}.xlsx`)
}
