"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { sanitizeFilenamePart } from "@/lib/audit-checklist-export-lines"
import { findingCategoryLabels } from "@/lib/finding-category"

// ─── Types (mirrors GET /api/audit-plan/[id]/report response) ────────────────

export type AuditPlanReportData = {
  entry: {
    auditNumber: string
    field: string
    categoryName: string
    subCategoryName: string | null
    datePlanned: string
    datePostponed: string | null
    initializedDate: string | null
    ct: string
    remarks: string | null
    status: string
    cancellationReason: string | null
    createdAt: string
    updatedAt: string
  }
  auditors: string[]
  auditees: string[]
  checklists: {
    checklistId: number
    title: string
    checklistNumber: string
    revision: number
    sessionStatus: string | null
    auditorComment: string | null
    auditeeComment: string | null
    items: {
      label: string
      reference: string | null
      section: string | null
      isHeading: boolean
      result: string | null
      notes: string | null
      auditeeNotes: string | null
      finding: { findingCode: string; findingLevel: string; findingCategory: string | null; status: string } | null
      attachments: { fileName: string; uploadedBy: string; fileSizeBytes: number | null; uploadedAt: string }[]
    }[]
  }[]
  findings: {
    findingCode: string
    findingLevel: string
    findingCategory: string | null
    explanation: string
    reference: string | null
    field: string | null
    status: string
    initializedOn: string
    dueDate: string | null
    isManual: boolean
    assignedTo: { name: string | null; department: string | null } | null
    latestResponse: {
      rootCause: string | null
      correctiveAction: string | null
      preventiveAction: string | null
      cpaStatus: string
    } | null
  }[]
  documents: { fileName: string; uploadedByName: string | null; fileSizeBytes: number | null; createdAt: string }[]
  history: {
    createdAt: string
    eventType: string
    statusFrom: string | null
    statusTo: string | null
    note: string | null
    actorName: string | null
  }[]
  summary: {
    totalQuestions: number
    unsatisfactoryCount: number
    totalFindings: number
    openFindings: number
    closedFindings: number
  }
}

const resultLabels: Record<string, string> = {
  S: "Satisfactory",
  U: "Unsatisfactory",
  NA: "N/A",
  OBS: "Gözlem",
}

const findingLevelLabels: Record<string, string> = {
  Level1: "Level 1",
  Level2: "Level 2",
  Observation: "Gözlem",
}

/** SACA/SAFA denetimlerinde dolu olur; diğerlerinde null — boşsa "—" döner. */
function findingCategoryLabel(category: string | null): string {
  if (!category) return "—"
  return (findingCategoryLabels as Record<string, string>)[category] ?? category
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso))
  } catch {
    return "—"
  }
}

function fmtBytes(n: number | null): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Denetim sonucu / conclusion — mevcut verilerden türetilen özet metin */
function buildConclusion(data: AuditPlanReportData): string {
  const { summary } = data
  const parts: string[] = []
  parts.push(
    `Denetim kapsamında toplam ${summary.totalQuestions} checklist maddesi değerlendirilmiş, bunlardan ${summary.unsatisfactoryCount} tanesi Unsatisfactory olarak işaretlenmiştir.`
  )
  if (summary.totalFindings > 0) {
    parts.push(
      `Denetim sonucunda toplam ${summary.totalFindings} bulgu (finding) oluşturulmuştur — ${summary.openFindings} açık, ${summary.closedFindings} kapalı.`
    )
  } else {
    parts.push("Denetim sonucunda herhangi bir bulgu oluşturulmamıştır.")
  }
  return parts.join(" ")
}

function addHeader(doc: jsPDF, title: string, data: AuditPlanReportData, margin: number): number {
  let y = 16
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text(title, margin, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(`${data.entry.auditNumber} — ${data.entry.field}`, margin, y)
  y += 6
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.text(
    `Durum: ${data.entry.status} · Planlanan Tarih: ${data.entry.datePlanned}${
      data.entry.initializedDate ? ` · Başlangıç: ${data.entry.initializedDate}` : ""
    }${data.entry.datePostponed ? ` · Ertelenen: ${data.entry.datePostponed}` : ""}`,
    margin,
    y
  )
  y += 5
  doc.text(
    `Denetçiler: ${data.auditors.length > 0 ? data.auditors.join(", ") : "—"}`,
    margin,
    y
  )
  y += 5
  doc.text(
    `Denetlenenler: ${data.auditees.length > 0 ? data.auditees.join(", ") : "—"}`,
    margin,
    y
  )
  y += 7
  return y
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - margin) {
    doc.addPage()
    return 16
  }
  return y
}

function sectionTitle(doc: jsPDF, text: string, y: number, margin: number): number {
  y = ensureSpace(doc, y, 12, margin)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(text, margin, y)
  return y + 6
}

function lastAutoTableY(doc: jsPDF): number {
  const d = doc as unknown as { lastAutoTable?: { finalY?: number } }
  return d.lastAutoTable?.finalY ?? 20
}

function filenameBase(data: AuditPlanReportData, kind: "initial" | "full"): string {
  return sanitizeFilenamePart(`${data.entry.auditNumber}-${kind === "initial" ? "initial-report" : "full-report"}`)
}

// ─── Initial Report — kısa özet raporu ────────────────────────────────────────

export function downloadInitialReportPdf(data: AuditPlanReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 14
  let y = addHeader(doc, "Denetim İlk Raporu (Initial Report)", data, margin)

  y = sectionTitle(doc, "Özet", y, margin)
  autoTable(doc, {
    startY: y,
    head: [["Toplam Soru", "Unsatisfactory", "Toplam Bulgu", "Açık Bulgu", "Kapalı Bulgu"]],
    body: [[
      String(data.summary.totalQuestions),
      String(data.summary.unsatisfactoryCount),
      String(data.summary.totalFindings),
      String(data.summary.openFindings),
      String(data.summary.closedFindings),
    ]],
    styles: { fontSize: 8.5, cellPadding: 2.5, halign: "center" },
    headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  })
  y = lastAutoTableY(doc) + 8

  if (data.findings.length > 0) {
    y = sectionTitle(doc, `Bulgular (${data.findings.length})`, y, margin)
    autoTable(doc, {
      startY: y,
      head: [["Kod", "Seviye", "Kategori", "Açıklama", "Sorumlu", "Durum"]],
      body: data.findings.map((f) => [
        f.findingCode,
        findingLevelLabels[f.findingLevel] ?? f.findingLevel,
        findingCategoryLabel(f.findingCategory),
        f.explanation,
        f.assignedTo?.name ?? "—",
        f.status === "Closed" ? "Kapalı" : "Açık",
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      columnStyles: { 3: { cellWidth: 65 } },
      margin: { left: margin, right: margin },
    })
    y = lastAutoTableY(doc) + 8
  }

  y = sectionTitle(doc, "Genel Notlar", y, margin)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const remarksText = data.entry.remarks?.trim() || "—"
  const remarksLines = doc.splitTextToSize(remarksText, 180)
  y = ensureSpace(doc, y, remarksLines.length * 4 + 4, margin)
  doc.text(remarksLines, margin, y)
  y += remarksLines.length * 4 + 8

  y = sectionTitle(doc, "Sonuç", y, margin)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const conclusionLines = doc.splitTextToSize(buildConclusion(data), 180)
  y = ensureSpace(doc, y, conclusionLines.length * 4 + 4, margin)
  doc.text(conclusionLines, margin, y)

  doc.save(`${filenameBase(data, "initial")}.pdf`)
}

// ─── Full Report — checklist + findings + files + audit info + closure ──────

export function downloadFullReportPdf(data: AuditPlanReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 14
  let y = addHeader(doc, "Denetim Tam Raporu (Full Report)", data, margin)

  // Denetim Bilgileri
  y = sectionTitle(doc, "Denetim Bilgileri", y, margin)
  autoTable(doc, {
    startY: y,
    body: [
      ["Audit No", data.entry.auditNumber],
      ["Kategori", data.entry.categoryName],
      ["Alt Kategori", data.entry.subCategoryName ?? "—"],
      ["Planlanan Tarih", data.entry.datePlanned],
      ["Ertelenen Tarih", data.entry.datePostponed ?? "—"],
      ["Başlangıç Tarihi", data.entry.initializedDate ?? "—"],
      ["C / T", data.entry.ct?.trim() || "—"],
      ["Durum", data.entry.status],
      ...(data.entry.cancellationReason ? [["İptal Nedeni", data.entry.cancellationReason]] : []),
      ["Kayıt Oluşturma", fmtDateTime(data.entry.createdAt)],
      ["Son Güncelleme", fmtDateTime(data.entry.updatedAt)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    theme: "grid",
    margin: { left: margin, right: margin },
  })
  y = lastAutoTableY(doc) + 8

  // Checklist'ler — checklist atanmamış (document-based) denetimlerde açıkça belirtilir
  if (data.checklists.length === 0) {
    y = sectionTitle(doc, "Checklist", y, margin)
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.text("No checklist assigned", margin, y)
    y += 8
  }
  for (const cl of data.checklists) {
    y = sectionTitle(
      doc,
      `Checklist: ${cl.title} (${cl.checklistNumber} · Rev ${cl.revision})${cl.sessionStatus ? ` — ${cl.sessionStatus}` : " — Başlanmadı"}`,
      y,
      margin
    )

    const body = cl.items
      .filter((it) => !it.isHeading)
      .map((it) => [
        it.reference ?? "—",
        it.label,
        it.result ? (resultLabels[it.result] ?? it.result) : "—",
        [it.notes, it.auditeeNotes ? `Denetlenen: ${it.auditeeNotes}` : ""].filter(Boolean).join("\n") || "—",
        it.finding
          ? `${it.finding.findingCode} (${findingLevelLabels[it.finding.findingLevel] ?? it.finding.findingLevel}${it.finding.findingCategory ? ` · ${findingCategoryLabel(it.finding.findingCategory)}` : ""})`
          : "—",
      ])

    if (body.length === 0) {
      body.push(["—", "Bu checklist'te madde yok.", "—", "—", "—"])
    }

    autoTable(doc, {
      startY: y,
      head: [["Ref", "Madde", "Sonuç", "Notlar", "Bulgu"]],
      body,
      styles: { fontSize: 7.5, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [44, 82, 130], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 62 },
        2: { cellWidth: 20 },
        3: { cellWidth: 55 },
        4: { cellWidth: 25 },
      },
      margin: { left: margin, right: margin },
    })
    y = lastAutoTableY(doc) + 6

    if (cl.auditorComment?.trim() || cl.auditeeComment?.trim()) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      if (cl.auditorComment?.trim()) {
        const lines = doc.splitTextToSize(`Denetçi Yorumu: ${cl.auditorComment.trim()}`, 180)
        y = ensureSpace(doc, y, lines.length * 4 + 2, margin)
        doc.text(lines, margin, y)
        y += lines.length * 4 + 2
      }
      if (cl.auditeeComment?.trim()) {
        const lines = doc.splitTextToSize(`Denetlenen Yorumu: ${cl.auditeeComment.trim()}`, 180)
        y = ensureSpace(doc, y, lines.length * 4 + 2, margin)
        doc.text(lines, margin, y)
        y += lines.length * 4 + 2
      }
      y += 4
    }
  }

  // Bulgular (checklist üzerinden otomatik + manuel)
  y = sectionTitle(doc, `Bulgular / Findings (${data.findings.length})`, y, margin)
  if (data.findings.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Kod", "Seviye", "Kategori", "Kaynak", "Açıklama", "Sorumlu / Departman", "Vade", "Durum", "CPA"]],
      body: data.findings.map((f) => [
        f.findingCode,
        findingLevelLabels[f.findingLevel] ?? f.findingLevel,
        findingCategoryLabel(f.findingCategory),
        f.isManual ? "Manuel" : "Checklist",
        f.explanation,
        f.assignedTo ? `${f.assignedTo.name ?? "—"}${f.assignedTo.department ? ` (${f.assignedTo.department})` : ""}` : "—",
        fmtDate(f.dueDate),
        f.status === "Closed" ? "Kapalı" : "Açık",
        f.latestResponse
          ? [
              f.latestResponse.correctiveAction ? `DF: ${f.latestResponse.correctiveAction}` : "",
              f.latestResponse.preventiveAction ? `ÖF: ${f.latestResponse.preventiveAction}` : "",
            ].filter(Boolean).join("\n") || "—"
          : "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        4: { cellWidth: 36 },
        8: { cellWidth: 34 },
      },
      margin: { left: margin, right: margin },
    })
    y = lastAutoTableY(doc) + 8
  } else {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.text("Bu denetimde bulgu oluşturulmamıştır.", margin, y)
    y += 8
  }

  // Dosyalar
  y = sectionTitle(doc, `Yüklenen Dosyalar (${data.documents.length})`, y, margin)
  if (data.documents.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Dosya Adı", "Yükleyen", "Boyut", "Tarih"]],
      body: data.documents.map((d) => [d.fileName, d.uploadedByName ?? "—", fmtBytes(d.fileSizeBytes), fmtDate(d.createdAt)]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      margin: { left: margin, right: margin },
    })
    y = lastAutoTableY(doc) + 8
  } else {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.text("Bu denetime dosya yüklenmemiştir.", margin, y)
    y += 8
  }

  // Genel Notlar
  y = sectionTitle(doc, "Genel Notlar", y, margin)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const remarksLines = doc.splitTextToSize(data.entry.remarks?.trim() || "—", 180)
  y = ensureSpace(doc, y, remarksLines.length * 4 + 4, margin)
  doc.text(remarksLines, margin, y)
  y += remarksLines.length * 4 + 8

  // Denetim Sonucu / Conclusion
  y = sectionTitle(doc, "Denetim Sonucu / Conclusion", y, margin)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const conclusionLines = doc.splitTextToSize(buildConclusion(data), 180)
  y = ensureSpace(doc, y, conclusionLines.length * 4 + 4, margin)
  doc.text(conclusionLines, margin, y)
  y += conclusionLines.length * 4 + 8

  // Kapanış Bilgileri / Geçmiş
  y = sectionTitle(doc, "Kapanış Bilgileri / Geçmiş", y, margin)
  if (data.history.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Tarih", "Olay", "Kullanıcı", "Detay"]],
      body: data.history.map((h) => [
        fmtDateTime(h.createdAt),
        h.eventType === "REOPENED" ? "Yeniden Açıldı" : `Durum: ${h.statusFrom ?? "—"} → ${h.statusTo ?? "—"}`,
        h.actorName ?? "—",
        h.note ?? "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold" },
      margin: { left: margin, right: margin },
    })
  } else {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.text("Kayıtlı geçmiş olayı yok.", margin, y)
  }

  doc.save(`${filenameBase(data, "full")}.pdf`)
}
