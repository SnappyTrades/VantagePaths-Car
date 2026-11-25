import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileText,
  Info,
  Lock,
  ShieldAlert,
  Sparkles,
  Unlock,
  Upload,
} from 'lucide-react';
import type { AuditFinding, AuditVerticalId, PublicAuditResponse } from '../shared/types';
import { downloadAuditPdf } from '../utils/pdfExport';

interface Props {
  vertical: AuditVerticalId;
  initialAudit?: PublicAuditResponse | null;
  sampleVariant?: string;
  customBadge?: string;
  customTitle?: string;
  customSampleLabel?: string;
  customPlaceholder?: string;
}

export const AuditWorkspace: React.FC<Props> = ({
  vertical,
  initialAudit = null,
  sampleVariant,
  customBadge,
  customTitle,
  customSampleLabel,
  customPlaceholder,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [audit, setAudit] = useState<PublicAuditResponse | null>(initialAudit);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialAudit && initialAudit.vertical === vertical) {
      setAudit(initialAudit);
    }
  }, [vertical, initialAudit]);

  const handleRunAudit = async (useSample = false) => {
    setError(null);
    setNotice(null);
    if (!useSample && !selectedFile && !rawText.trim()) {
      setError('Upload a PDF/photo/CSV, paste quote text, or click the sample button.');
      return;
    }

    setAuditing(true);
    try {
      let res: Response;
      if (selectedFile && !useSample) {
        const fd = new FormData();
        fd.append('vertical', vertical);
        fd.append('file', selectedFile);
        if (rawText.trim()) fd.append('rawText', rawText.trim());
        if (contextNote.trim()) fd.append('contextNote', contextNote.trim());
        res = await fetch('/api/audit', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vertical,
            useSample,
            sampleVariant: useSample ? sampleVariant : undefined,
            rawText: useSample ? '' : rawText,
            contextNote,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed.');
      setAudit(data as PublicAuditResponse);
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'paywall_viewed', vertical, auditId: data.auditId }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete audit.');
    } finally {
      setAuditing(false);
    }
  };

  const handleCheckout = async (tier: 'pass' | 'pro') => {
    if (!audit) return;
    setUnlocking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: audit.auditId, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout error.');

      if (data.mode === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.mode === 'demo' && data.demoUnlockAllowed) {
        const unlockRes = await fetch('/api/billing/demo-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auditId: audit.auditId }),
        });
        const unlocked = await unlockRes.json();
        if (!unlockRes.ok) throw new Error(unlocked.error || 'Demo unlock failed.');
        setAudit(unlocked as PublicAuditResponse);
        setNotice(
          'Unlocked in local Demo Mode — add STRIPE_SECRET_KEY in .env to collect real Stripe card payments immediately.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleCopyScript = async () => {
    if (!audit?.counterOfferScript) return;
    const full = audit.counterOfferSubject
      ? `Subject: ${audit.counterOfferSubject}\n\n${audit.counterOfferScript}`
      : audit.counterOfferScript;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'script_copied', vertical, auditId: audit.auditId }),
    }).catch(() => {});
  };

  const handleDownloadPdf = () => {
    if (!audit) return;
    downloadAuditPdf(audit);
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'pdf_downloaded', vertical, auditId: audit.auditId }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              <Sparkles className="h-3 w-3" /> {customBadge || 'Dealer OTD & Contract PDF Auditor'}
            </span>
            <h3 className="font-serif-display mt-1.5 text-xl font-bold text-[#0B1528]">
              {customTitle || 'Upload Any Dealer Quote, Buyer’s Order, or Contract PDF — Free Red-Flag Preview'}
            </h3>
          </div>
          <button
            type="button"
            disabled={auditing}
            onClick={() => handleRunAudit(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-bold text-[#0F766E] transition hover:bg-teal-100 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {customSampleLabel || 'Try Sample RAV4 Dealer OTD ($46,842)'}
          </button>
        </div>

        {/* File Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) setSelectedFile(f);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-[#FAF9F5] p-5 text-center transition hover:border-[#0F766E] hover:bg-teal-50/40"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*,.csv,.txt"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <Upload className="mx-auto h-6 w-6 text-[#0F766E]" />
          <p className="mt-2 text-sm font-semibold text-[#0B1528]">
            {selectedFile ? (
              <span className="text-[#0F766E]">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </span>
            ) : (
              'Drop a PDF, phone photo of a dealer sheet, or contract page here'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports PDF, PNG, JPG, WEBP, CSV, TXT (up to 10 MB) • Private, self-service analysis
          </p>
        </div>

        {/* Paste Text + Context */}
        <div className="mt-3 grid grid-cols-1 gap-3">
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              customPlaceholder ||
              'Or paste the emailed dealer quote, itemized OTD numbers, MSRP, add-ons, doc fee, APR, or lease money factor...'
            }
            className="w-full rounded-xl border border-slate-200 bg-[#FAF9F5] px-3.5 py-2.5 text-sm text-[#0B1528] placeholder-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="Optional context (e.g., your home state, credit score tier, or trade-in offer)"
              className="flex-1 rounded-xl border border-slate-200 bg-[#FAF9F5] px-3.5 py-2.5 text-sm text-[#0B1528] placeholder-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              disabled={auditing}
              onClick={() => handleRunAudit(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1528] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F766E] disabled:opacity-60"
            >
              {auditing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Auditing Document...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" /> Run Free Audit
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}
      </div>

      {/* Audit Result Scorecard */}
      {audit && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F766E]" />
              <span>{notice}</span>
            </div>
          )}

          {/* Top Verdict + Savings Hero (High-Contrast Midnight Navy) */}
          <div className="flex flex-col justify-between gap-4 rounded-xl bg-[#0B1528] p-5 text-white md:flex-row md:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                    audit.verdictTone === 'high_risk'
                      ? 'bg-rose-500/20 text-rose-300'
                      : audit.verdictTone === 'moderate_risk'
                      ? 'bg-amber-400/20 text-amber-200'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {audit.verdictTone === 'high_risk'
                    ? 'High-Risk Markups Found'
                    : audit.verdictTone === 'moderate_risk'
                    ? 'Review Flags Before Signing'
                    : 'Looks Competitive'}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {audit.fileName} • {audit.modelUsed ? `${audit.llmProvider} (${audit.modelUsed})` : 'Deterministic Engine'}
                </span>
              </div>
              <h4 className="font-serif-display text-xl font-bold text-white">{audit.verdictLabel}</h4>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-300">{audit.documentSummary}</p>
            </div>

            <div className="shrink-0 rounded-xl border border-teal-400/30 bg-teal-500/15 px-5 py-3.5 text-left md:text-right">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-teal-300">
                Est. Recoverable Savings
              </div>
              <div className="font-mono text-3xl font-extrabold text-emerald-300">
                ${audit.estimatedSavingsUsd.toLocaleString()}
              </div>
              <div className="mt-0.5 text-xs text-slate-200">
                Fair Benchmark: <span className="font-mono font-semibold text-white">{audit.fairRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Line Item Comparison Table */}
          {audit.lineItems.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-[#FAF9F5] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                Line-Item Audit Breakdown
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Line Item</th>
                      <th className="px-4 py-2.5">Quoted</th>
                      <th className="px-4 py-2.5">Fair Benchmark</th>
                      <th className="px-4 py-2.5 text-right">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#0B1528]">
                    {audit.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-semibold">{item.label}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">{item.quotedAmount}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{item.benchmarkAmount}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                              item.status === 'OVERCHARGED' || item.status === 'MISSING'
                                ? 'bg-rose-100 text-rose-800'
                                : item.status === 'SUSPECT'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Free Preview Findings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Free Preview Findings ({audit.freeFlags.length})
              </h4>
              <span className="font-mono text-[11px] text-slate-400">Audit ID: {audit.auditId}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {audit.freeFlags.map((flag, i) => (
                <FindingCard key={i} finding={flag} />
              ))}
            </div>
          </div>

          {/* SERVER-ENFORCED PAYWALL OR UNLOCKED FULL PACK */}
          {!audit.isUnlocked ? (
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#0F766E]/35 bg-gradient-to-br from-teal-50/80 via-white to-[#FAF9F5] p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                    <Lock className="h-3.5 w-3.5" />
                    {audit.lockedFlagsCount} More Deep Catches + Counter-Offer Script &amp; PDF Locked
                  </div>
                  <h4 className="font-serif-display text-xl font-bold text-[#0B1528]">
                    Unlock Your Full Self-Service Report &amp; Word-for-Word Pushback Email
                  </h4>
                  <p className="max-w-xl text-sm text-slate-600">
                    Reveals all {audit.lockedFlagsCount} remaining red flags, a ready-to-send email citing exact dollar adjustments, your negotiation checklist, and a downloadable branded PDF memo.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    disabled={unlocking}
                    onClick={() => handleCheckout('pass')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-teal-900/15 transition hover:bg-[#115E59] disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {audit.stripeLiveConfigured
                      ? `Unlock Now — $${audit.pricing.passPriceUsd} (60-Day Pass)`
                      : `Demo Unlock — $${audit.pricing.passPriceUsd} Pass Preview`}
                  </button>
                  <span className="text-center text-[11px] text-slate-500">
                    {audit.stripeLiveConfigured
                      ? 'One-time Stripe checkout • Zero recurring subscription'
                      : 'Local test mode: add STRIPE_SECRET_KEY in .env for live cards'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 border-t border-slate-200 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <Unlock className="h-3.5 w-3.5" /> Full Report Unlocked ({audit.unlockMethod})
                </span>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B1528] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F766E]"
                >
                  <Download className="h-4 w-4" /> Download Branded PDF Memo
                </button>
              </div>

              {audit.lockedFlags.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F766E]">
                    Unlocked Deep-Audit Findings ({audit.lockedFlags.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {audit.lockedFlags.map((flag, i) => (
                      <FindingCard key={i} finding={flag} />
                    ))}
                  </div>
                </div>
              )}

              {audit.counterOfferScript && (
                <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F766E]">
                        Ready-to-Send Self-Service Email
                      </span>
                      {audit.counterOfferSubject && (
                        <div className="mt-0.5 text-sm font-bold text-[#0B1528]">
                          Subject: {audit.counterOfferSubject}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#0B1528] hover:bg-slate-50"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#0F766E]" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Email
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-800">
                    {audit.counterOfferScript}
                  </pre>
                </div>
              )}

              {audit.negotiationChecklist.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Next-Step Action Checklist
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {audit.negotiationChecklist.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FindingCard: React.FC<{ finding: AuditFinding }> = ({ finding }) => {
  const Icon =
    finding.level === 'CRITICAL'
      ? ShieldAlert
      : finding.level === 'WARNING'
      ? AlertTriangle
      : Info;
  const tone =
    finding.level === 'CRITICAL'
      ? 'border-rose-200 bg-rose-50/70 text-rose-800'
      : finding.level === 'WARNING'
      ? 'border-amber-200 bg-amber-50/70 text-amber-900'
      : 'border-sky-200 bg-sky-50/70 text-sky-900';

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-[#0B1528]">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm">{finding.title}</span>
        </div>
        {finding.estimatedImpactUsd && finding.estimatedImpactUsd > 0 ? (
          <span className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#0F766E] shadow-xs">
            ~${finding.estimatedImpactUsd.toLocaleString()}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{finding.detail}</p>
    </div>
  );
};
