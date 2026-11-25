import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Lock,
  Mail,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type { PublicAuditResponse } from '../shared/types';
import { downloadAuditPdf } from '../utils/pdfExport';

const PASS_STORAGE_KEY = 'vp_active_pass_audit_id';

interface Props {
  kit: PublicAuditResponse;
  onKitUpdated: (updated: PublicAuditResponse) => void;
  headline: string;
  subheadline: string;
  bullets: string[];
  showCertifiedMailOption?: boolean;
}

/**
 * Enforces the founder monetization rule across ALL pillars:
 * - Diagnostic math & calculators are free (proves value & ROI).
 * - EVERY generated email, formal cancellation letter, direct-bypass address,
 *   dealer counter-offer script, quote spec sheet & branded PDF requires a fee ($14 Single or $29 All-Access Pass).
 */
export const LockedGeneratorCard: React.FC<Props> = ({
  kit,
  onKitUpdated,
  headline,
  subheadline,
  bullets,
  showCertifiedMailOption = false,
}) => {
  const [unlocking, setUnlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If user already unlocked the $29 60-Day All-Access Pass in this browser, auto-redeem on server!
  useEffect(() => {
    if (kit.isUnlocked) return;
    const savedPassId = localStorage.getItem(PASS_STORAGE_KEY);
    if (!savedPassId) return;
    fetch('/api/billing/redeem-pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId: kit.auditId, passAuditId: savedPassId }),
    })
      .then(async (r) => {
        if (r.ok) {
          const unlocked = (await r.json()) as PublicAuditResponse;
          onKitUpdated(unlocked);
        }
      })
      .catch(() => {});
  }, [kit.auditId, kit.isUnlocked]);

  const handleCheckout = async (tier: 'single' | 'pass' | 'pro') => {
    setUnlocking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: kit.auditId, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout error.');

      if (data.mode === 'stripe' && data.checkoutUrl) {
        if (tier === 'pass') {
          localStorage.setItem(PASS_STORAGE_KEY, kit.auditId);
        }
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.mode === 'demo' && data.demoUnlockAllowed) {
        const uRes = await fetch('/api/billing/demo-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auditId: kit.auditId }),
        });
        const unlocked = await uRes.json();
        if (!uRes.ok) throw new Error(unlocked.error || 'Unlock failed.');
        if (tier === 'pass') {
          localStorage.setItem(PASS_STORAGE_KEY, kit.auditId);
        }
        onKitUpdated(unlocked as PublicAuditResponse);
        setNotice(
          tier === 'pro'
            ? 'Demo Mode: Unlocked + 1-Click USPS Certified Mail (+$15) previewed! Add STRIPE_SECRET_KEY in .env for live card payments.'
            : 'Demo Mode: Unlocked! Add STRIPE_SECRET_KEY in .env to route directly to live Stripe Checkout.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setUnlocking(false);
    }
  };

  if (!kit.isUnlocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#05A66B]/40 bg-gradient-to-br from-emerald-50/80 via-white to-[#FAF9F5] p-6 shadow-sm">
        {/* Blurred Document Preview */}
        <div className="pointer-events-none mb-5 select-none rounded-xl border border-slate-200 bg-white p-4 opacity-45 blur-[4px]">
          <div className="font-mono text-xs font-bold text-[#082545]">
            TO: Plan Administrator Cancellations Dept. • Direct Bypass Routing Address
          </div>
          <p className="mt-1.5 text-xs text-slate-600">
            Please accept this signed formal notice to immediately process my full statutory refund and remit directly to lienholder principal...
          </p>
        </div>

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              <Lock className="h-3.5 w-3.5" /> Generated Letter, Direct Routing &amp; PDF Locked
            </span>
            <h3 className="font-display text-xl font-extrabold text-[#082545]">{headline}</h3>
            <p className="max-w-xl text-xs leading-relaxed text-slate-600">{subheadline}</p>
            <ul className="space-y-1 pt-1 text-xs font-medium text-slate-700">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#05A66B]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 flex-col gap-2.5 sm:min-w-[270px]">
            <button
              type="button"
              disabled={unlocking}
              onClick={() => handleCheckout('single')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#05A66B] px-5 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#048A58] disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {kit.stripeLiveConfigured ? 'Unlock This Letter Kit — $14' : 'Unlock Letter Kit — $14 (Demo)'}
            </button>
            <button
              type="button"
              disabled={unlocking}
              onClick={() => handleCheckout('pass')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#082545] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#0F345E] disabled:opacity-50"
            >
              Best Value: 60-Day All-Access Pass — $29
            </button>
            {showCertifiedMailOption && (
              <button
                type="button"
                disabled={unlocking}
                onClick={() => handleCheckout('pro')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#082545] hover:bg-slate-50"
              >
                <Mail className="h-3.5 w-3.5 text-[#05A66B]" /> + Add 1-Click USPS Certified Mail ($15)
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-xs font-bold text-rose-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[#05A66B]/40 bg-emerald-50/35 p-5">
      {notice && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-900">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
          <Unlock className="h-3.5 w-3.5" /> Self-Service Packet Unlocked ({kit.unlockMethod})
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!kit.counterOfferScript) return;
              const full = kit.counterOfferSubject
                ? `Subject: ${kit.counterOfferSubject}\n\n${kit.counterOfferScript}`
                : kit.counterOfferScript;
              await navigator.clipboard.writeText(full);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#082545] hover:bg-slate-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#05A66B]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy Primary Letter / Email'}
          </button>
          <button
            type="button"
            onClick={() => downloadAuditPdf(kit)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#082545] px-4 py-2 text-xs font-bold text-white hover:bg-[#05A66B]"
          >
            <Download className="h-3.5 w-3.5" /> Download Branded PDF Packet
          </button>
        </div>
      </div>

      {kit.counterOfferSubject && (
        <div className="text-xs font-bold text-[#082545]">Subject: {kit.counterOfferSubject}</div>
      )}

      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-xs leading-relaxed text-slate-800">
        {kit.counterOfferScript}
      </pre>

      {kit.lockedFlags.map((f, idx) => (
        <details key={idx} open={idx === 0} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <summary className="cursor-pointer text-xs font-extrabold text-[#082545]">
            Bonus Script #{idx + 1}: {f.title}
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
            {f.detail}
          </pre>
        </details>
      ))}

      {kit.negotiationChecklist.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Step-by-Step Self-Service Action Checklist
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {kit.negotiationChecklist.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#05A66B]" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
