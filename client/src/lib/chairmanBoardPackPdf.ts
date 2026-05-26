import { buildChairmanNarrative, type ChairmanBriefInput } from './chairmanNarrative'
import { FOUNDATION_RGB } from './foundationTheme'
import { formatCompactNgn, formatPct } from './format'

export type ChairmanBoardPackInput = ChairmanBriefInput & {
  recommendations?: { headline: string; body: string; priority: string }[]
}

const GOLD = [...FOUNDATION_RGB.harvest] as [number, number, number]
const INK = [...FOUNDATION_RGB.ink] as [number, number, number]
const MUTED = [...FOUNDATION_RGB.muted] as [number, number, number]
const PAGE_BOTTOM = 780
const MARGIN = 48

type PdfDoc = import('jspdf').jsPDF

function ensureSpace(doc: PdfDoc, y: number, need: number): number {
  if (y + need > PAGE_BOTTOM) {
    doc.addPage()
    drawPageFooter(doc)
    return MARGIN + 8
  }
  return y
}

function drawPageFooter(doc: PdfDoc) {
  const w = doc.internal.pageSize.getWidth()
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, PAGE_BOTTOM - 24, w - MARGIN, PAGE_BOTTOM - 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Ola Olabinjo Investment · Family Office Command Centre · Confidential', MARGIN, PAGE_BOTTOM - 12)
}

function sectionTitle(doc: PdfDoc, title: string, y: number, contentW: number): number {
  y = ensureSpace(doc, y, 36)
  doc.setFillColor(248, 246, 240)
  doc.rect(MARGIN, y - 4, contentW, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(title, MARGIN + 8, y + 10)
  return y + 28
}

function bodyParagraphs(doc: PdfDoc, paragraphs: string[], y: number, contentW: number): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const lineHeight = 13
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, contentW)
    y = ensureSpace(doc, y, lines.length * lineHeight + 8)
    doc.text(lines, MARGIN, y)
    y += lines.length * lineHeight + 10
  }
  return y
}

function bulletList(doc: PdfDoc, items: string[], y: number, contentW: number): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const lineHeight = 13
  const bulletIndent = 12
  for (const item of items) {
    const lines = doc.splitTextToSize(item, contentW - bulletIndent)
    y = ensureSpace(doc, y, lines.length * lineHeight + 6)
    doc.text('•', MARGIN, y)
    doc.text(lines, MARGIN + bulletIndent, y)
    y += lines.length * lineHeight + 6
  }
  return y + 4
}

function metricsGrid(
  doc: PdfDoc,
  rows: { label: string; value: string; hint?: string }[],
  y: number,
  contentW: number
): number {
  const colW = contentW / 2 - 8
  const rowH = 44
  let row = 0
  for (let i = 0; i < rows.length; i += 2) {
    y = ensureSpace(doc, y, rowH + 8)
    for (let c = 0; c < 2; c++) {
      const item = rows[i + c]
      if (!item) continue
      const x = MARGIN + c * (colW + 16)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, y, colW, rowH, 4, 4, 'S')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(item.label.toUpperCase(), x + 10, y + 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...INK)
      doc.text(item.value, x + 10, y + 30)
      if (item.hint) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...MUTED)
        doc.text(item.hint, x + 10, y + 40)
      }
    }
    y += rowH + 10
    row++
  }
  return y
}

function buildAttentionItems(data: ChairmanBoardPackInput): string[] {
  const items: string[] = []
  if (data.outstandingDocumentation > 0) {
    items.push(
      `${data.outstandingDocumentation} outstanding document tracker item${data.outstandingDocumentation === 1 ? '' : 's'}`
    )
  }
  if ((data.complianceCalendar?.overdueCount ?? 0) > 0) {
    items.push(
      `${data.complianceCalendar!.overdueCount} overdue compliance calendar item${data.complianceCalendar!.overdueCount === 1 ? '' : 's'}`
    )
  }
  if ((data.complianceCalendar?.dueNext30Count ?? 0) > 0) {
    items.push(
      `${data.complianceCalendar!.dueNext30Count} compliance item${data.complianceCalendar!.dueNext30Count === 1 ? '' : 's'} due within 30 days`
    )
  }
  if (data.pendingDecisions > 0) {
    items.push(`${data.pendingDecisions} open decision${data.pendingDecisions === 1 ? '' : 's'} awaiting action`)
  }
  return items
}

/**
 * Download a branded principal overview PDF for board circulation.
 */
export async function downloadChairmanBoardPackPdf(data: ChairmanBoardPackInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const contentW = doc.internal.pageSize.getWidth() - MARGIN * 2
  let y = MARGIN

  doc.setFillColor(...GOLD)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  const brand = data.brand || 'Ola Olabinjo Investment'
  doc.text(brand, MARGIN, y + 8)
  y += 28

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GOLD)
  doc.text('Family Office — Principal overview', MARGIN, y)
  y += 16

  doc.setTextColor(...MUTED)
  doc.setFontSize(9)
  if (data.asOf) {
    const asOf = String(data.asOf).replace('T', ' ').slice(0, 19)
    doc.text(`Book as of ${asOf} UTC · figures in NGN unless noted`, MARGIN, y)
    y += 14
  }
  doc.text(`Generated ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, MARGIN, y)
  y += 22

  y = sectionTitle(doc, 'Executive summary', y, contentW)
  y = bodyParagraphs(doc, buildChairmanNarrative(data), y, contentW)

  y = sectionTitle(doc, 'Key figures', y, contentW)
  y = metricsGrid(
    doc,
    [
      { label: 'Net position', value: formatCompactNgn(data.netPosition), hint: 'Assets − liabilities' },
      { label: 'Total assets', value: formatCompactNgn(data.totalAssets) },
      { label: 'Total liabilities', value: formatCompactNgn(data.totalLiabilities) },
      { label: 'Cash position', value: formatCompactNgn(data.cashPosition) },
      { label: 'Liquidity ratio', value: formatPct(data.liquidityRatio) },
      { label: 'Health score', value: String(data.portfolioHealthScore), hint: '0–100 internal' },
    ],
    y,
    contentW
  )

  const attention = buildAttentionItems(data)
  if (attention.length) {
    y = sectionTitle(doc, 'Attention', y, contentW)
    y = bulletList(doc, attention, y, contentW)
  }

  const recs = (data.recommendations ?? []).slice(0, 5)
  if (recs.length) {
    y = sectionTitle(doc, 'Recommended focus', y, contentW)
    for (const r of recs) {
      const title = `[${r.priority}] ${r.headline}`
      const titleLines = doc.splitTextToSize(title, contentW)
      const bodyLines = doc.splitTextToSize(r.body, contentW)
      y = ensureSpace(doc, y, titleLines.length * 12 + bodyLines.length * 11 + 16)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...INK)
      doc.text(titleLines, MARGIN, y)
      y += titleLines.length * 12 + 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.text(bodyLines, MARGIN, y)
      y += bodyLines.length * 11 + 14
    }
  }

  y = ensureSpace(doc, y, 60)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + contentW, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const disclaimer =
    'This overview is generated from the live family office book for principal awareness only. It is not investment advice, a valuation opinion, or a substitute for professional counsel. Register detail and operator workflows remain in the secure portal.'
  doc.text(doc.splitTextToSize(disclaimer, contentW), MARGIN, y)

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    drawPageFooter(doc)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`${p} / ${pageCount}`, doc.internal.pageSize.getWidth() - MARGIN - 24, PAGE_BOTTOM - 12)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`OOI-principal-overview-${stamp}.pdf`)
}
