"use client"

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import {
  type ChecklistExportLine,
  sanitizeFilenamePart,
} from "@/lib/audit-checklist-export-lines"

export type ChecklistExportMeta = {
  title: string
  checklistNumber: string
  revisionNumber: number
  revisionDate: string
  description: string | null
  lines: ChecklistExportLine[]
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadChecklistPdf(meta: ChecklistExportMeta): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 14
  let y = 16
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(meta.title, margin, y)
  y += 7
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(
    `No: ${meta.checklistNumber} · Revizyon #${meta.revisionNumber} · Tarih: ${meta.revisionDate}`,
    margin,
    y
  )
  y += 5
  if (meta.description?.trim()) {
    const desc = doc.splitTextToSize(`Açıklama: ${meta.description.trim()}`, 180)
    doc.text(desc, margin, y)
    y += desc.length * 4 + 2
  }

  const body: unknown[] = []
  for (const line of meta.lines) {
    if (line.kind === "section") {
      body.push([
        {
          content: line.text.toUpperCase(),
          colSpan: 3,
          styles: {
            fillColor: [44, 82, 130],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
        },
      ])
    } else {
      body.push([String(line.num), line.reference, line.label])
    }
  }

  if (body.length === 0) {
    body.push([
      {
        content: "Bu revizyonda madde yok.",
        colSpan: 3,
        styles: { fontStyle: "italic", textColor: 120 },
      },
    ])
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Referanslar", "Maddeler"]],
    body: body as never,
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 42 },
    },
    margin: { left: margin, right: margin },
  })

  const base = sanitizeFilenamePart(`${meta.checklistNumber}-rev-${meta.revisionNumber}`)
  doc.save(`${base}.pdf`)
}

export async function downloadChecklistDocx(meta: ChecklistExportMeta): Promise<void> {
  const headerCells = ["#", "Referanslar", "Maddeler"].map(
    (t) =>
      new TableCell({
        shading: { fill: "1A365D" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: t, bold: true, color: "FFFFFF" })],
          }),
        ],
      })
  )

  const rows: TableRow[] = [new TableRow({ children: headerCells })]

  for (const line of meta.lines) {
    if (line.kind === "section") {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              shading: { fill: "2C5282" },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.text.toUpperCase(),
                      bold: true,
                      color: "FFFFFF",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      )
    } else {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: String(line.num) })],
            }),
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: line.reference })],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun(line.label)] })],
            }),
          ],
        })
      )
    }
  }

  if (meta.lines.length === 0) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Bu revizyonda madde yok.", italics: true })],
              }),
            ],
          }),
        ],
      })
    )
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: meta.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `No: ${meta.checklistNumber} · Revizyon #${meta.revisionNumber} · Tarih: ${meta.revisionDate}`,
                size: 20,
              }),
            ],
            spacing: { after: meta.description?.trim() ? 80 : 160 },
          }),
          ...(meta.description?.trim()
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Açıklama: ${meta.description.trim()}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 160 },
                }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const base = sanitizeFilenamePart(`${meta.checklistNumber}-rev-${meta.revisionNumber}`)
  triggerDownload(blob, `${base}.docx`)
}
