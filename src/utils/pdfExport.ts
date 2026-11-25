import type { PublicAuditResponse } from '../shared/types';

/**
 * Lazy-loads jsPDF only when the user actually clicks "Download PDF"
 * so the initial page load stays ~400 kB lighter and ultra-fast on mobile!
 */
export async function downloadAuditPdf(audit: PublicAuditResponse): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 44;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 48;
    }
  };

  // Header Bar
  doc.setFillColor(11, 21, 40);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setTextColor(45, 212, 191);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VANTAGEPATHS.COM  •  INDEPENDENT SELF-SERVICE AUTO ADVOCATE', margin, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('AUTO DEAL, CONTRACT & REFUND AUDIT PACKET', margin, 54);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Audit ID: ${audit.auditId}   |   File: ${audit.fileName}   |   Generated: ${new Date(
      audit.createdUtc
    ).toLocaleString()}`,
    margin,
    72
  );

  y = 108;

  // Verdict & Savings Banner
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(margin, y, maxWidth, 72, 6, 6, 'F');
  doc.setTextColor(11, 21, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(audit.verdictLabel.slice(0, 68), margin + 14, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Fair Benchmark: ${audit.fairRangeLabel}`, margin + 14, y + 44);
  if (audit.billedTotalUsd != null) {
    doc.text(
      `Document Quoted Total: $${audit.billedTotalUsd.toLocaleString()}`,
      margin + 14,
      y + 60
    );
  }

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const savingsLabel = `$${audit.estimatedSavingsUsd.toLocaleString()}`;
  doc.text(savingsLabel, pageWidth - margin - 14, y + 34, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('EST. RECOVERABLE VALUE', pageWidth - margin - 14, y + 50, { align: 'right' });

  y += 92;

  // Summary
  doc.setTextColor(11, 21, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Executive Summary', margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(audit.documentSummary, maxWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 14;

  // Line-Item Breakdown Table
  if (audit.lineItems.length > 0) {
    ensureSpace(80);
    doc.setTextColor(11, 21, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Line-Item Audit Comparison', margin, y);
    y += 14;

    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, maxWidth, 20, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('ITEM', margin + 6, y + 13);
    doc.text('QUOTED', margin + 210, y + 13);
    doc.text('BENCHMARK', margin + 320, y + 13);
    doc.text('STATUS', pageWidth - margin - 6, y + 13, { align: 'right' });
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const item of audit.lineItems) {
      ensureSpace(22);
      doc.setTextColor(15, 23, 42);
      doc.text(item.label.slice(0, 38), margin + 6, y + 10);
      doc.text(item.quotedAmount.slice(0, 22), margin + 210, y + 10);
      doc.text(item.benchmarkAmount.slice(0, 26), margin + 320, y + 10);
      if (item.status === 'OVERCHARGED' || item.status === 'MISSING') {
        doc.setTextColor(185, 28, 28);
      } else if (item.status === 'SUSPECT') {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(15, 118, 110);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(item.status, pageWidth - margin - 6, y + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 16, pageWidth - margin, y + 16);
      y += 20;
    }
    y += 12;
  }

  // All Findings (Free + Unlocked)
  const allFindings = [...audit.freeFlags, ...audit.lockedFlags];
  ensureSpace(60);
  doc.setTextColor(11, 21, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Audit Findings & Included Escalation Templates (${allFindings.length})`, margin, y);
  y += 16;

  for (const f of allFindings) {
    const detailLines = doc.splitTextToSize(f.detail, maxWidth - 14);
    const blockHeight = 20 + detailLines.length * 13 + 10;
    ensureSpace(Math.min(140, blockHeight));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (f.level === 'CRITICAL') doc.setTextColor(185, 28, 28);
    else if (f.level === 'WARNING') doc.setTextColor(180, 83, 9);
    else doc.setTextColor(15, 118, 110);

    const impactStr =
      f.estimatedImpactUsd && f.estimatedImpactUsd > 0
        ? `  (Est. $${f.estimatedImpactUsd.toLocaleString()})`
        : '';
    doc.text(`[${f.level}] ${f.title}${impactStr}`, margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    for (const dLine of detailLines) {
      ensureSpace(14);
      doc.text(dLine, margin + 10, y);
      y += 13;
    }
    y += 8;
  }

  // Counter-Offer / Cancellation Script
  if (audit.isUnlocked && audit.counterOfferScript) {
    ensureSpace(100);
    y += 6;
    doc.setTextColor(11, 21, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Ready-to-Send Self-Service Letter / Email', margin, y);
    y += 16;

    if (audit.counterOfferSubject) {
      doc.setFontSize(9.5);
      doc.setTextColor(11, 21, 40);
      doc.text(`Subject: ${audit.counterOfferSubject}`, margin, y);
      y += 15;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const scriptLines = doc.splitTextToSize(audit.counterOfferScript, maxWidth - 16);
    for (const line of scriptLines) {
      ensureSpace(15);
      doc.text(line, margin + 8, y);
      y += 13;
    }
    y += 12;
  }

  // Checklist
  if (audit.isUnlocked && audit.negotiationChecklist.length > 0) {
    ensureSpace(60);
    doc.setTextColor(11, 21, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Step-by-Step Self-Service Checklist', margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    audit.negotiationChecklist.forEach((step, idx) => {
      const lines = doc.splitTextToSize(`${idx + 1}. ${step}`, maxWidth - 10);
      ensureSpace(lines.length * 13 + 6);
      doc.text(lines, margin + 6, y);
      y += lines.length * 13 + 4;
    });
  }

  // Footer Disclaimer on last page
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Self-Service Informational Toolkit: VantagePaths provides independent benchmarks & templates you review, sign, and send yourself — not legal, tax, or representation services.',
    margin,
    pageHeight - 24
  );

  doc.save(`VantagePaths_Auto_${audit.auditId}.pdf`);
}
