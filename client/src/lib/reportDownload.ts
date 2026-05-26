import { flattenReportRows } from '../components/reports/ReportHumanReadout'
import { FOUNDATION_RGB } from './foundationTheme'
import type { ReportSlug } from './reportsCatalog'

export function downloadReportJson(data: Record<string, unknown>, slug: ReportSlug) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ooi-report-${slug}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadReportPdf(data: Record<string, unknown>) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...FOUNDATION_RGB.harvest)
  doc.text(String(data.title ?? 'Ola Olabinjo Investment — Report'), margin, y)
  y += 28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...FOUNDATION_RGB.ink)
  const rows = flattenReportRows(data)
  const lineHeight = 11
  const maxY = 780
  for (const row of rows) {
    const chunks = doc.splitTextToSize(`${row.key}: ${String(row.value)}`, 500)
    for (const chunk of chunks) {
      if (y > maxY) {
        doc.addPage()
        y = margin
      }
      doc.text(chunk, margin, y)
      y += lineHeight
    }
  }
  doc.save(`OOI-report-${Date.now()}.pdf`)
}

export async function downloadReportExcel(data: Record<string, unknown>) {
  const XLSX = await import('xlsx')
  const rows = flattenReportRows(data)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `OOI-report-${Date.now()}.xlsx`)
}
