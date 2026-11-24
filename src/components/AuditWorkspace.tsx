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
}

const VERTICAL_COPY: Record<
  AuditVerticalId,
  {
    accent: string;
    badge: string;
    uploadHint: string;
    sampleBtn: string;
    placeholder: string;
  }
> = {
  freight: {
    accent: 'emerald',
    badge: 'Freight Invoice & Rate-Con Auditor',
    uploadHint: 'Drop a carrier invoice PDF, rate confirmation photo, or billing CSV',
    sampleBtn: 'Try Sample Freight Invoice ($5,100)',
    placeholder:
      'Or paste your carrier invoice, rate confirmation, accessorial breakdown, or lane details here...',
  },
  auto: {
    accent: 'sky',
    badge: 'Dealer OTD, APR & Lease Auditor',
    uploadHint: 'Snap/drop a dealer worksheet photo, buyer’s order PDF, or lease sheet',
    sampleBtn: 'Try Sample RAV4 Dealer OTD ($46,842)',
    placeholder:
      'Or paste the dealership Out-The-Door worksheet, MSRP, add-ons, doc fee, APR, or lease money factor...',
  },
  'home-bids': {
    accent: 'amber',
    badge: 'Contractor Bid & Storm Claim Auditor',
    uploadHint: 'Drop a roof/HVAC/remodel bid PDF, photo, or insurance Xactimate estimate',
    sampleBtn: 'Try Sample 24-Sq Roof Bid ($28,950)',
    placeholder:
      'Or paste your contractor proposal, lump-sum quote, payment terms, or insurance claim estimate...',
  },
};

export const AuditWorkspace: React.FC<Props> = ({
  vertical,
  initialAudit = null,
  sampleVariant,
  customBadge,
  customTitle,
  customSampleLabel,
}) => {
  const copy = VERTICAL_COPY[vertical];
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
    } else if (audit && audit.vertical !== vertical) {
      setAudit(null);
      setSelectedFile(null);
      setRawText('');
      setError(null);
      setNotice(null);
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
        body: JSON.stringify({
          eventName: 'paywall_viewed',
          vertical,
          auditId: data.auditId,
        }),
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
          'Unlocked in local Demo Mode (add STRIPE_SECRET_KEY in .env to route this button directly to live Stripe Checkout).'
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3 w-3" /> {customBadge || copy.badge}
            </span>
            <h2 className="mt-1.5 text-lg font-bold text-white">
              {customTitle || 'Upload a PDF, Photo, or Paste Your Quote — Free Instant Red-Flag Preview'}
            </h2>
          </div>
          <button
            type="button"
            disabled={auditing}
            onClick={() => handleRunAudit(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {customSampleLabel || copy.sampleBtn}
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
          className="cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-5 text-center transition hover:border-emerald-500/60 hover:bg-slate-950"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*,.csv,.txt"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <Upload className="mx-auto h-7 w-7 text-emerald-400" />
          <p className="mt-2 text-sm font-medium text-slate-200">
            {selectedFile ? (
              <span className="text-emerald-400">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </span>
            ) : (
              copy.uploadHint
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports PDF, PNG, JPG, WEBP, CSV, TXT (up to 10 MB) • Analyzed by $0 Free-Tier Vision AI
          </p>
        </div>

        {/* Paste Text + Context */}
        <div className="mt-3 grid grid-cols-1 gap-3">
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={copy.placeholder}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              placeholder="Optional context (e.g., your state, credit score tier, contracted rate-con total, or zip code)"
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={auditing}
              onClick={() => handleRunAudit(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {auditing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
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
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Audit Result Scorecard */}
      {audit && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl sm:p-6">
          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Top Verdict + Savings Hero */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/90 p-5 md:flex-row md:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                    audit.verdictTone === 'high_risk'
                      ? 'bg-rose-500/15 text-rose-400'
                      : audit.verdictTone === 'moderate_risk'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {audit.verdictTone === 'high_risk'
                    ? 'High-Risk Overcharges Found'
                    : audit.verdictTone === 'moderate_risk'
                    ? 'Review Flags Before Signing'
                    : 'Looks Competitive'}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {audit.fileName} •{' '}
                  {audit.modelUsed ? `${audit.llmProvider} (${audit.modelUsed})` : 'Deterministic Engine'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{audit.verdictLabel}</h3>
              <p className="max-w-2xl text-sm text-slate-400">{audit.documentSummary}</p>
            </div>

            <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3.5 text-left md:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Est. Recoverable Savings
              </div>
              <div className="font-mono text-3xl font-extrabold text-emerald-400">
                ${audit.estimatedSavingsUsd.toLocaleString()}
              </div>
              <div className="mt-0.5 text-xs text-slate-300">
                Fair Range: <span className="font-mono font-semibold text-white">{audit.fairRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Line Item Comparison Table */}
          {audit.lineItems.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="border-b border-slate-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Line-Item Audit Breakdown
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Line Item</th>
                      <th className="px-4 py-2.5">Quoted</th>
                      <th className="px-4 py-2.5">Fair Benchmark</th>
                      <th className="px-4 py-2.5 text-right">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {audit.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-medium">{item.label}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-300">{item.quotedAmount}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{item.benchmarkAmount}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              item.status === 'OVERCHARGED' || item.status === 'MISSING'
                                ? 'bg-rose-500/15 text-rose-400'
                                : item.status === 'SUSPECT'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-400'
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

          {/* Free Findings (Always Shown) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Free Preview Findings ({audit.freeFlags.length})
              </h4>
              <span className="text-xs text-slate-500">Server-verified audit #{audit.auditId}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {audit.freeFlags.map((flag, i) => (
                <FindingCard key={i} finding={flag} />
              ))}
            </div>
          </div>

          {/* SERVER-ENFORCED PAYWALL OR UNLOCKED FULL PACK */}
          {!audit.isUnlocked ? (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 p-6">
              {/* Blurred Teaser Background */}
              <div className="pointer-events-none mb-5 grid select-none grid-cols-1 gap-3 opacity-35 blur-[3px] md:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <div className="h-3 w-36 rounded bg-rose-400/50" />
                  <div className="mt-2 h-2.5 w-full rounded bg-slate-600" />
                  <div className="mt-1.5 h-2.5 w-4/5 rounded bg-slate-700" />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <div className="h-3 w-44 rounded bg-amber-400/50" />
                  <div className="mt-2 h-2.5 w-full rounded bg-slate-600" />
                  <div className="mt-1.5 h-2.5 w-3/4 rounded bg-slate-700" />
                </div>
              </div>

              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                    {audit.lockedFlagsCount} Additional Red Flags + Counter-Offer Script & PDF Locked
                  </div>
                  <h4 className="text-xl font-bold text-white">
                    Unlock Your Full Dispute Report & Word-for-Word Counter-Offer
                  </h4>
                  <p className="max-w-xl text-sm text-slate-300">
                    Includes all {audit.lockedFlagsCount} remaining line-item catches, a ready-to-send pushback email citing exact dollar adjustments, negotiation checklist, and a downloadable branded PDF memo.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    disabled={unlocking}
                    onClick={() => handleCheckout('pass')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {audit.stripeLiveConfigured
                      ? `Unlock Now — $${audit.pricing.passPriceUsd} (${audit.pricing.passName})`
                      : `Demo Unlock — $${audit.pricing.passPriceUsd} Pass Preview`}
                  </button>
                  <button
                    type="button"
                    disabled={unlocking}
                    onClick={() => handleCheckout('pro')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
                  >
                    {audit.stripeLiveConfigured
                      ? `Go Pro Unlimited — $${audit.pricing.proPriceUsd}/mo`
                      : `Preview Pro Unlimited ($${audit.pricing.proPriceUsd}/mo)`}
                  </button>
                </div>
              </div>
              {!audit.stripeLiveConfigured && (
                <p className="mt-3 text-[11px] text-slate-400">
                  Local test mode: Stripe checkout is pre-wired. Add <code className="text-emerald-300">STRIPE_SECRET_KEY</code> to <code className="text-emerald-300">.env</code> to collect real card payments immediately.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5 border-t border-slate-800 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Unlock className="h-3.5 w-3.5" /> Full Audit Unlocked ({audit.unlockMethod})
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                >
                  <Download className="h-4 w-4" /> Download Branded Audit PDF
                </button>
              </div>

              {/* Unlocked Findings */}
              {audit.lockedFlags.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                    Unlocked Deep-Audit Catches ({audit.lockedFlags.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {audit.lockedFlags.map((flag, i) => (
                      <FindingCard key={i} finding={flag} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ready-to-Send Counter-Offer Script */}
              {audit.counterOfferScript && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Ready-to-Send Pushback Email
                      </span>
                      {audit.counterOfferSubject && (
                        <div className="mt-0.5 text-sm font-bold text-white">
                          Subject: {audit.counterOfferSubject}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Email
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/70 p-4 font-sans text-sm leading-relaxed text-slate-200">
                    {audit.counterOfferScript}
                  </pre>
                </div>
              )}

              {/* Negotiation Checklist */}
              {audit.negotiationChecklist.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                    Next-Step Negotiation Checklist
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-300">
                    {audit.negotiationChecklist.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
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
      ? 'border-rose-500/35 bg-rose-500/5 text-rose-300'
      : finding.level === 'WARNING'
      ? 'border-amber-500/35 bg-amber-500/5 text-amber-300'
      : 'border-sky-500/35 bg-sky-500/5 text-sky-300';

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-white">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm">{finding.title}</span>
        </div>
        {finding.estimatedImpactUsd && finding.estimatedImpactUsd > 0 ? (
          <span className="shrink-0 rounded-md bg-slate-950/80 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
            ~${finding.estimatedImpactUsd.toLocaleString()}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{finding.detail}</p>
    </div>
  );
};
