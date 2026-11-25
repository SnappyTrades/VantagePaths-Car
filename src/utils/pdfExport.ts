import type { jsPDF as JsPdfType } from 'jspdf';
import type { PublicAuditResponse } from '../shared/types';

/**
 * Normalizes Unicode punctuation & arrows into clean WinAnsi / ASCII characters
 * so jsPDF's built-in Helvetica font never triggers multibyte spacing or mojibake
 * (such as rendering "→" as "!'").
 */
export function sanitizePdfText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/\u2192|\u2794|\u279C|\u27A1/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, ' - ')
    .replace(/\u2026/g, '...')
    .replace(/\u2605|\u2B50/g, '*')
    .replace(/\u2022/g, '|')
    .replace(/\u00A0/g, ' ')
    // Strip any remaining non-Latin1 codepoints that Helvetica cannot render
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/ {3,}/g, '  ');
}

export async function buildAuditPdfDocument(audit: PublicAuditResponse): Promise<JsPdfType> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 612pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792pt
  const margin = 44;
  const maxWidth = pageWidth - margin * 2; // 524pt
  const bottomLimit = pageHeight - 52;
  let y = 44;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 48;
    }
  };

  const drawTopBrandHeader = (subtitle: string) => {
    doc.setFillColor(8, 37, 69); // #082545 Deep Navy
    doc.rect(0, 0, pageWidth, 84, 'F');
    doc.setFillColor(5, 166, 107); // #05A66B Path Emerald
    doc.rect(0, 80, pageWidth, 4, 'F');

    // Brand Wordmark
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Vantage', margin, 30);
    const vWidth = doc.getTextWidth('Vantage');
    doc.setTextColor(5, 166, 107);
    doc.setFont('helvetica', 'bolditalic');
    doc.text('Paths', margin + vWidth + 1, 30);

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(
      'Smarter, from your couch.',
      pageWidth - margin,
      30,
      { align: 'right' }
    );

    // Document Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(sanitizePdfText(subtitle), margin, 51);

    // Wrapped / Bounded Metadata Line (never clips right margin!)
    doc.setTextColor(186, 201, 218);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    const shortDate = new Date(audit.createdUtc).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const packetLabel =
      audit.fileName.length > 58 ? `${audit.fileName.slice(0, 55).trimEnd()}...` : audit.fileName;
    const metaStr = sanitizePdfText(
      `ID: ${audit.auditId}  |  Packet: ${packetLabel}  |  Date: ${shortDate}`
    );
    doc.text(metaStr, margin, 68);
  };

  // =========================================================================
  // PAGE 1: EXECUTIVE AUDIT SCORECARD & ACTION CHECKLIST
  // =========================================================================
  drawTopBrandHeader('EXECUTIVE DEAL, CONTRACT & REFUND SCORECARD');
  y = 104;

  // Two-Column Verdict & Savings Banner (strict left/right width isolation!)
  const rightColWidth = 148;
  const leftColMaxWidth = maxWidth - rightColWidth - 28; // ~348pt

  const cleanVerdict = sanitizePdfText(audit.verdictLabel);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const verdictLines = doc.splitTextToSize(cleanVerdict, leftColMaxWidth);

  const cleanFair = sanitizePdfText(`Benchmark: ${audit.fairRangeLabel}`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const fairLines = doc.splitTextToSize(cleanFair, leftColMaxWidth);

  const quotedLine =
    audit.billedTotalUsd != null
      ? sanitizePdfText(`Document Quoted Total: $${audit.billedTotalUsd.toLocaleString()}`)
      : null;

  const bannerHeight = Math.max(
    76,
    20 + verdictLines.length * 15 + fairLines.length * 13 + (quotedLine ? 14 : 0) + 12
  );

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, y, maxWidth, bannerHeight, 6, 6, 'FD');

  // Vertical divider inside banner
  doc.setDrawColor(204, 251, 241);
  doc.line(
    pageWidth - margin - rightColWidth - 8,
    y + 12,
    pageWidth - margin - rightColWidth - 8,
    y + bannerHeight - 12
  );

  // Left Column inside Banner
  let by = y + 22;
  doc.setTextColor(8, 37, 69);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(verdictLines, margin + 14, by);
  by += verdictLines.length * 15 + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(fairLines, margin + 14, by);
  by += fairLines.length * 13 + 2;

  if (quotedLine) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(quotedLine, margin + 14, by);
  }

  // Right Column inside Banner (Recoverable Value)
  const rightCenterY = y + bannerHeight / 2;
  doc.setTextColor(5, 166, 107);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(
    `$${audit.estimatedSavingsUsd.toLocaleString()}`,
    pageWidth - margin - 14,
    rightCenterY + 1,
    { align: 'right' }
  );
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('EST. RECOVERABLE VALUE', pageWidth - margin - 14, rightCenterY + 15, {
    align: 'right',
  });

  y += bannerHeight + 20;

  // Executive Summary
  doc.setTextColor(8, 37, 69);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Executive Summary', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(sanitizePdfText(audit.documentSummary), maxWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 13.5 + 16;

  // Line-Item Breakdown Table
  if (audit.lineItems.length > 0) {
    ensureSpace(80);
    doc.setTextColor(8, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Line-Item Audit Breakdown', margin, y);
    y += 12;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, maxWidth, 20, 'F');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('ITEM', margin + 8, y + 13);
    doc.text('QUOTED / PAID', margin + 215, y + 13);
    doc.text('BENCHMARK / REFUND', margin + 325, y + 13);
    doc.text('FLAG', pageWidth - margin - 8, y + 13, { align: 'right' });
    y += 24;

    doc.setFontSize(9);
    const isRefundPacket = audit.auditId.startsWith('vp_autorefund_');
    for (const item of audit.lineItems) {
      ensureSpace(22);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(item.label).slice(0, 38), margin + 8, y + 10);
      doc.text(sanitizePdfText(item.quotedAmount).slice(0, 20), margin + 215, y + 10);
      doc.text(sanitizePdfText(item.benchmarkAmount).slice(0, 24), margin + 325, y + 10);

      const displayStatus =
        isRefundPacket && item.status === 'OVERCHARGED' ? 'CANCELLABLE' : item.status;

      if (displayStatus === 'CANCELLABLE') {
        doc.setTextColor(5, 166, 107);
      } else if (item.status === 'OVERCHARGED' || item.status === 'MISSING') {
        doc.setTextColor(185, 28, 28);
      } else if (item.status === 'SUSPECT') {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(5, 166, 107);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(displayStatus, pageWidth - margin - 8, y + 10, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 16, pageWidth - margin, y + 16);
      y += 20;
    }
    y += 14;
  }

  // Separate short diagnostic findings vs. full-length bonus template letters
  const diagnosticFindings = [
    ...audit.freeFlags,
    ...audit.lockedFlags.filter((f) => f.detail.length < 360 && !f.title.includes('Included')),
  ];
  const bonusTemplateFindings = audit.lockedFlags.filter(
    (f) => f.detail.length >= 360 || f.title.includes('Included')
  );

  if (diagnosticFindings.length > 0) {
    ensureSpace(60);
    doc.setTextColor(8, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Key Audit Findings (${diagnosticFindings.length})`, margin, y);
    y += 15;

    for (const f of diagnosticFindings) {
      const cleanTitle = sanitizePdfText(f.title);
      const cleanDetail = sanitizePdfText(f.detail);
      const detailLines = doc.splitTextToSize(cleanDetail, maxWidth - 12);
      ensureSpace(18 + detailLines.length * 13 + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (f.level === 'CRITICAL') doc.setTextColor(185, 28, 28);
      else if (f.level === 'WARNING') doc.setTextColor(180, 83, 9);
      else doc.setTextColor(5, 166, 107);

      const impactStr =
        f.estimatedImpactUsd && f.estimatedImpactUsd > 0
          ? `  (Est. $${f.estimatedImpactUsd.toLocaleString()})`
          : '';
      const headingLines = doc.splitTextToSize(`[${f.level}] ${cleanTitle}${impactStr}`, maxWidth);
      doc.text(headingLines, margin, y);
      y += headingLines.length * 13 + 2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(detailLines, margin + 10, y);
      y += detailLines.length * 12.5 + 8;
    }
    y += 6;
  }

  // Step-by-Step Action Checklist right on Page 1
  if (audit.isUnlocked && audit.negotiationChecklist.length > 0) {
    ensureSpace(70);
    doc.setTextColor(8, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Step-by-Step Self-Service Action Checklist', margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    audit.negotiationChecklist.forEach((step, idx) => {
      const lines = doc.splitTextToSize(
        sanitizePdfText(`${idx + 1}. ${step}`),
        maxWidth - 8
      );
      ensureSpace(lines.length * 12.5 + 5);
      doc.text(lines, margin + 4, y);
      y += lines.length * 12.5 + 4;
    });
  }

  // =========================================================================
  // PAGE 2 (STANDALONE PAGE!): READY-TO-SIGN PRIMARY LETTER / EMAIL
  // Started on its own clean page without VantagePaths marketing banners in the
  // body so the buyer can print/sign/mail this page directly to the provider!
  // =========================================================================
  if (audit.isUnlocked && audit.counterOfferScript) {
    doc.addPage();
    y = 38;

    // Subtle detach instruction bar at very top
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, maxWidth, 22, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(8, 37, 69);
    doc.text(
      'DOCUMENT 1  |  PRIMARY SELF-SERVICE NOTICE (PRINT, SIGN & SEND DIRECTLY)',
      margin + 10,
      y + 14
    );
    y += 32;

    if (audit.counterOfferSubject) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(8, 37, 69);
      const subjLines = doc.splitTextToSize(
        sanitizePdfText(`Subject: ${audit.counterOfferSubject}`),
        maxWidth
      );
      doc.text(subjLines, margin, y);
      y += subjLines.length * 11.8 + 6;

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 7;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.9);
    doc.setTextColor(15, 23, 42);
    const scriptParagraphs = sanitizePdfText(audit.counterOfferScript).split('\n');
    for (const para of scriptParagraphs) {
      if (!para.trim()) {
        y += 5.5;
        continue;
      }
      const wrapped = doc.splitTextToSize(para, maxWidth);
      ensureSpace(wrapped.length * 11.4 + 1.5);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 11.4 + 1;
    }
  }

  // =========================================================================
  // PAGE 3+: ESCALATION & FOLLOW-UP TEMPLATES (STALL-BUSTER + LENDER SCRIPT)
  // =========================================================================
  if (audit.isUnlocked && bonusTemplateFindings.length > 0) {
    doc.addPage();
    y = 38;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, maxWidth, 22, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(8, 37, 69);
    doc.text(
      'FOLLOW-UP & ESCALATION TEMPLATES (USE IF DEALER STALLS OR WHEN REFUND POSTS)',
      margin + 10,
      y + 14
    );
    y += 34;

    bonusTemplateFindings.forEach((tmpl, idx) => {
      ensureSpace(90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(8, 37, 69);
      const tLines = doc.splitTextToSize(
        sanitizePdfText(`Template ${idx + 2}: ${tmpl.title.replace(/\s*Included$/i, '')}`),
        maxWidth
      );
      doc.text(tLines, margin, y);
      y += tLines.length * 14 + 4;

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const bodyParas = sanitizePdfText(tmpl.detail).split('\n');
      for (const p of bodyParas) {
        if (!p.trim()) {
          y += 7;
          continue;
        }
        const w = doc.splitTextToSize(p, maxWidth);
        ensureSpace(w.length * 12.2 + 2);
        doc.text(w, margin, y);
        y += w.length * 12.2 + 1.5;
      }
      y += 20;
    });
  }

  // =========================================================================
  // MULTI-PAGE FOOTER WITH WRAPPED DISCLAIMER & PAGE X OF Y (ZERO CLIPPING!)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  const disclaimer =
    'Self-Service Informational Toolkit: VantagePaths provides independent benchmarks & templates you review, sign, and send yourself - not legal, tax, or representation services.';

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 42, pageWidth - margin, pageHeight - 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    const dLines = doc.splitTextToSize(disclaimer, maxWidth - 75);
    doc.text(dLines, margin, pageHeight - 30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 26, {
      align: 'right',
    });
  }

  return doc;
}

export async function downloadAuditPdf(audit: PublicAuditResponse): Promise<void> {
  const doc = await buildAuditPdfDocument(audit);
  doc.save(`VantagePaths_Auto_${audit.auditId}.pdf`);
}
