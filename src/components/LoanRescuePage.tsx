import React, { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Gavel,
  Lock,
  Mail,
  Scale,
  Search,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type { PublicAuditResponse } from '../shared/types';
import { AuditWorkspace } from './AuditWorkspace';
import { PartnerCard } from './PartnerCard';
import { downloadAuditPdf } from '../utils/pdfExport';

interface Props {
  refData: any;
  initialAudit?: PublicAuditResponse | null;
}

export const LoanRescuePage: React.FC<Props> = ({ refData, initialAudit = null }) => {
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    return d.toISOString().slice(0, 10);
  }, []);

  const [purchaseDate, setPurchaseDate] = useState(defaultDate);
  const [stateCode, setStateCode] = useState('TX');
  const [currentLoanBalanceUsd, setCurrentLoanBalanceUsd] = useState(40500);
  const [estimatedVehicleValueUsd, setEstimatedVehicleValueUsd] = useState(30500);
  const [loanAprPct, setLoanAprPct] = useState(9.89);
  const [targetRefiAprPct, setTargetRefiAprPct] = useState(5.99);
  const [loanTermMonths, setLoanTermMonths] = useState(72);
  const [purchaseMileage, setPurchaseMileage] = useState(40);
  const [currentMileage, setCurrentMileage] = useState(1150);
  const [financedInLoan, setFinancedInLoan] = useState(true);
  const [claimsFiled, setClaimsFiled] = useState(false);

  const [vscOn, setVscOn] = useState(true);
  const [vscCost, setVscCost] = useState(3495);
  const [gapOn, setGapOn] = useState(true);
  const [gapCost, setGapCost] = useState(1195);
  const [tireOn, setTireOn] = useState(true);
  const [tireCost, setTireCost] = useState(895);
  const [maintOn, setMaintOn] = useState(false);
  const [maintCost, setMaintCost] = useState(1100);

  const [buyerName, setBuyerName] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [adminName, setAdminName] = useState('Fidelity Warranty Services / JM&A');
  const [lenderName, setLenderName] = useState('');
  const [vehicleYmm, setVehicleYmm] = useState('');
  const [vin, setVin] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const [rescue, setRescue] = useState<any>(null);
  const [kit, setKit] = useState<PublicAuditResponse | null>(
    initialAudit && initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
  );
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mailNotice, setMailNotice] = useState<string | null>(null);

  // Legal Add-On Decoder & Admin Search
  const [addonFilter, setAddonFilter] = useState<'ALL' | 'REQUIRED' | 'OPTIONAL' | 'CANCELLABLE'>('ALL');
  const [adminSearch, setAdminSearch] = useState('');

  const filteredAddons = useMemo(() => {
    const list = refData?.addons || [];
    return list.filter((a: any) => {
      if (addonFilter === 'REQUIRED') return a.legallyRequired === 'REQUIRED';
      if (addonFilter === 'OPTIONAL') return a.legallyRequired === 'OPTIONAL';
      if (addonFilter === 'CANCELLABLE') return a.cancellableAfterPurchase !== 'NO';
      return true;
    });
  }, [refData, addonFilter]);

  const filteredAdmins = useMemo(() => {
    const list = refData?.administrators || [];
    if (!adminSearch.trim()) return list;
    const q = adminSearch.toLowerCase();
    return list.filter(
      (a: any) => a.name.toLowerCase().includes(q) || a.products.toLowerCase().includes(q)
    );
  }, [refData, adminSearch]);

  const runRescue = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = [
      vscOn ? { type: 'vsc', label: 'Extended Warranty (VSC)', costUsd: vscCost, contractTermMonths: 72 } : null,
      gapOn ? { type: 'gap', label: 'GAP Debt Waiver', costUsd: gapCost, contractTermMonths: loanTermMonths } : null,
      tireOn ? { type: 'tire_wheel', label: 'Tire, Wheel & Key Bundle', costUsd: tireCost, contractTermMonths: 60 } : null,
      maintOn ? { type: 'maintenance', label: 'Prepaid Maintenance', costUsd: maintCost, contractTermMonths: 48 } : null,
    ].filter(Boolean);
    if (items.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auto/loan-rescue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseDateIso: purchaseDate,
          stateCode,
          currentLoanBalanceUsd,
          estimatedVehicleValueUsd,
          loanAprPct,
          targetRefiAprPct,
          loanTermMonths,
          purchaseMileage,
          currentMileage,
          financedInLoan,
          claimsFiled,
          items,
          buyerName,
          dealerName,
          administratorName: adminName,
          lenderName,
          vehicleYmm,
          vin,
          contractNumber,
        }),
      });
      const data = await res.json();
      setRescue(data.rescue);
      setKit(data.kit);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (tier: 'pass' | 'pro') => {
    if (!kit) return;
    setUnlocking(true);
    setMailNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: kit.auditId, tier }),
      });
      const data = await res.json();
      if (data.mode === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.mode === 'demo' && data.demoUnlockAllowed) {
        const uRes = await fetch('/api/billing/demo-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auditId: kit.auditId }),
        });
        setKit((await uRes.json()) as PublicAuditResponse);
        if (tier === 'pro') {
          setMailNotice(
            'Demo preview: 1-Click USPS Certified Mail (+$15) is ready for Lob.com API integration — download your pre-filled PDF below to send immediately.'
          );
        }
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
          Pillar 2 • 2-Step Car Loan Rescue &amp; F&amp;I Refunds
        </span>
        <h1 className="font-serif-display text-3xl font-bold text-[#0B1528] sm:text-4xl">
          Already Bought? Cancel Packed Add-Ons, Drop Your LTV &amp; Slash Your Monthly Payment
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Most buyers get denied for refinancing because \$3,500–\$5,500 of dealer add-ons pushed their Loan-to-Value (LTV) above 120%. Step 1: legally cancel those optional add-ons directly with the administrator. Step 2: once principal drops, refinance your marked-up dealer APR.
        </p>
      </div>

      {/* 2-STEP CAR LOAN RESCUE SIMULATOR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={runRescue} className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Purchase Date
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              State Purchased
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              >
                {(refData?.states || []).map((s: any) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <NumField label="Current Loan Balance ($)" value={currentLoanBalanceUsd} onChange={setCurrentLoanBalanceUsd} />
            <NumField label="Est. Car Value ($)" value={estimatedVehicleValueUsd} onChange={setEstimatedVehicleValueUsd} />
            <NumField label="Current Dealer APR (%)" value={loanAprPct} step="0.05" onChange={setLoanAprPct} />
            <NumField label="Target Credit Union Refi APR (%)" value={targetRefiAprPct} step="0.05" onChange={setTargetRefiAprPct} />
            <NumField label="Original Loan Term (mos)" value={loanTermMonths} onChange={setLoanTermMonths} />
            <NumField label="Current Odometer (mi)" value={currentMileage} onChange={setCurrentMileage} />
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Optional Add-Ons Rolled Into Your Contract:
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <ToggleCard label="Extended Warranty (VSC)" checked={vscOn} onToggle={setVscOn} cost={vscCost} onCost={setVscCost} />
              <ToggleCard label="Dealer GAP Waiver" checked={gapOn} onToggle={setGapOn} cost={gapCost} onCost={setGapCost} />
              <ToggleCard label="Tire, Wheel & Key" checked={tireOn} onToggle={setTireOn} cost={tireCost} onCost={setTireCost} />
              <ToggleCard label="Prepaid Maintenance" checked={maintOn} onToggle={setMaintOn} cost={maintCost} onCost={setMaintCost} />
            </div>
            <div className="mt-3 flex flex-wrap gap-5 text-xs font-medium text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={financedInLoan} onChange={(e) => setFinancedInLoan(e.target.checked)} className="accent-[#0F766E]" />
                Add-ons were financed in my auto loan
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={claimsFiled} onChange={(e) => setClaimsFiled(e.target.checked)} className="accent-amber-600" />
                I already filed a paid claim
              </label>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5">
            <summary className="cursor-pointer text-xs font-bold text-[#0F766E]">
              Optional: Pre-fill Name, VIN, Dealer, Administrator &amp; Lender for Ready-to-Sign Letters
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField label="Your Full Name" value={buyerName} onChange={setBuyerName} placeholder="Jordan Taylor" />
              <TextField label="Dealership Name" value={dealerName} onChange={setDealerName} placeholder="Suncrest Motors" />
              <TextField label="Plan Administrator" value={adminName} onChange={setAdminName} placeholder="Fidelity / Ally / Zurich / TFS" />
              <TextField label="Auto Lender" value={lenderName} onChange={setLenderName} placeholder="Capital One / Chase Auto" />
              <TextField label="Vehicle (Year Make Model)" value={vehicleYmm} onChange={setVehicleYmm} placeholder="2025 Honda CR-V Hybrid" />
              <TextField label="17-Digit VIN" value={vin} onChange={setVin} placeholder="2T3P1RFV..." />
            </div>
            <div className="mt-2">
              <TextField label="Contract / Policy #" value={contractNumber} onChange={setContractNumber} placeholder="Optional contract number" />
            </div>
          </details>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0F766E] px-6 py-3.5 text-sm font-extrabold text-white shadow-md shadow-teal-900/15 transition hover:bg-[#115E59] disabled:opacity-50"
          >
            {loading ? 'Running 2-Step Loan Rescue Simulation...' : 'Calculate My Refund, New LTV & Monthly Refi Savings (Free)'}
          </button>
        </form>

        {/* 2-STEP RESCUE RESULT */}
        {rescue && kit && (
          <div className="mt-7 space-y-6 border-t border-slate-200 pt-6">
            <div className="rounded-2xl bg-[#0B1528] p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-teal-400/20 px-3 py-1 font-mono text-[11px] font-bold uppercase text-teal-300">
                  {rescue.unlockedRefiEligibility ? '★ REFINANCE ELIGIBILITY UNLOCKED' : '2-STEP LOAN RESCUE PLAN'}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {rescue.refundEstimate.withinFreeLook ? '100% Free-Look Eligible' : 'Prorated Refund Eligible'}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-100">
                {rescue.rescueHeadline}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-400">Step 1: Add-On Refund</div>
                  <div className="font-mono text-2xl font-extrabold text-emerald-300">
                    ${rescue.refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-400">Loan-to-Value Drop</div>
                  <div className="font-mono text-2xl font-extrabold text-amber-300">
                    {rescue.currentLtvPct}% → {rescue.newLtvPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-400">Step 2: Refi Payment Drop</div>
                  <div className="font-mono text-2xl font-extrabold text-teal-300">
                    -${rescue.monthlyPaymentSavingsUsd}/mo
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-400">Combined Total Savings</div>
                  <div className="font-mono text-2xl font-extrabold text-white">
                    ${rescue.combinedTotalSavingsUsd.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* PAYWALL FOR SELF-SERVICE CANCELLATION PACKET (REVENUE LAYER 1) */}
            {!kit.isUnlocked ? (
              <div className="rounded-2xl border-2 border-[#0F766E]/40 bg-gradient-to-br from-teal-50/80 via-white to-[#FAF9F5] p-6">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                      <Lock className="h-3.5 w-3.5" /> Ready-to-Sign Cancellation Kit Locked ({Math.max(1, Math.round(rescue.combinedTotalSavingsUsd / 29))}× ROI)
                    </span>
                    <h3 className="font-serif-display text-xl font-bold text-[#0B1528]">
                      Unlock Your Formal Cancellation Demand Letter, Day-14 Stall-Buster &amp; Branded PDF
                    </h3>
                    <p className="max-w-xl text-xs leading-relaxed text-slate-600">
                      100% self-service templates pre-filled with your numbers so you bypass stalling dealership finance desks directly with the plan administrator.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      disabled={unlocking}
                      onClick={() => handleUnlock('pass')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#115E59]"
                    >
                      <CreditCard className="h-4 w-4" />
                      {kit.stripeLiveConfigured
                        ? `Unlock Full Packet — $${kit.pricing.passPriceUsd}`
                        : `Demo Unlock Packet ($${kit.pricing.passPriceUsd} Preview)`}
                    </button>
                    <button
                      type="button"
                      disabled={unlocking}
                      onClick={() => handleUnlock('pro')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#0B1528] hover:bg-slate-50"
                    >
                      <Mail className="h-3.5 w-3.5 text-[#0F766E]" /> + Add 1-Click USPS Certified Mail ($15)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50/40 p-5">
                {mailNotice && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-900">
                    {mailNotice}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    <Unlock className="h-3.5 w-3.5" /> Self-Service Cancellation Kit Unlocked
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!kit.counterOfferScript) return;
                        await navigator.clipboard.writeText(
                          `Subject: ${kit.counterOfferSubject}\n\n${kit.counterOfferScript}`
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#0B1528]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-[#0F766E]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied!' : 'Copy Cancellation Letter'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadAuditPdf(kit)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1528] px-4 py-2 text-xs font-bold text-white hover:bg-[#0F766E]"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Formal PDF Packet
                    </button>
                  </div>
                </div>

                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-xs leading-relaxed text-slate-800">
                  {kit.counterOfferScript}
                </pre>

                {kit.lockedFlags.map((f, idx) => (
                  <details key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <summary className="cursor-pointer text-xs font-bold text-[#0B1528]">
                      {idx + 2}. {f.title} (Expand)
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
                      {f.detail}
                    </pre>
                  </details>
                ))}
              </div>
            )}

            {/* STEP 2 PARTNER AFFILIATE CARD (REVENUE LAYER 2 — EARNS EVEN IF THEY DON'T BUY!) */}
            <PartnerCard
              partnerId="auto-refi-credit-union"
              badge={`Step 2 • Save ~$${rescue.monthlyPaymentSavingsUsd}/mo`}
              title="Ready to Drop Your Marked-Up Dealer APR? Compare Soft-Pull Auto Refinance Offers"
              subtitle={`Once your $${rescue.refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()} refund reduces your loan principal (LTV ${rescue.currentLtvPct}% → ${rescue.newLtvPct}%), check credit union & online refinance rates with zero hard credit pull.`}
              ctaLabel="Check Soft-Pull Refi Rates"
              source="loan_rescue_step2"
              accent="navy"
            />
          </div>
        )}
      </section>

      {/* SIGNED TILA CONTRACT BREAKDOWN AUDITOR */}
      <AuditWorkspace
        vertical="auto"
        sampleVariant="signed-contract"
        customBadge="Retail Installment Contract (TILA) Breakdown"
        customTitle="Upload or Paste Your Signed Loan Contract to Decode Every Box & Rolled-In Add-On"
        customSampleLabel="Try Sample Signed TILA Contract ($43,620)"
        initialAudit={
          initialAudit && !initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
        }
      />

      {/* LEGAL ADD-ON DECODER */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#0F766E]">
              <Scale className="h-3.5 w-3.5" /> Plain-English Legal Reference
            </span>
            <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
              What's Legally Required vs. 100% Optional &amp; Cancellable?
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ALL', 'All (13)'],
                ['REQUIRED', 'Required Only'],
                ['OPTIONAL', '100% Optional'],
                ['CANCELLABLE', 'Cancellable'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setAddonFilter(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  addonFilter === k
                    ? 'bg-[#0B1528] text-white'
                    : 'border border-slate-200 bg-[#FAF9F5] text-slate-700 hover:bg-slate-100'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filteredAddons.map((a: any) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0B1528]">{a.name}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    a.legallyRequired === 'REQUIRED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : a.legallyRequired === 'CONDITIONAL'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {a.legallyRequired === 'REQUIRED'
                    ? 'Legally Required'
                    : a.legallyRequired === 'CONDITIONAL'
                    ? 'Check State Cap'
                    : '100% Optional'}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{a.plainEnglish}</p>
              <div className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] text-slate-700 border border-slate-200/80">
                <strong className="text-[#0F766E]">Refund Rule: </strong>
                {a.cancellationNotes}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIRECT ADMINISTRATOR BYPASS DIRECTORY + OFFICIAL ESCALATION RESOURCES */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#0F766E]">
                <Building2 className="h-3.5 w-3.5" /> Bypass Stalling F&amp;I Desks
              </span>
              <h3 className="font-serif-display mt-1 text-xl font-bold text-[#0B1528]">
                Plan Administrator Directory
              </h3>
            </div>
            <div className="relative w-44">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Search Ally, Fidelity..."
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F5] py-1.5 pl-8 pr-2 text-xs"
              />
            </div>
          </div>
          <div className="mt-4 max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {filteredAdmins.map((adm: any) => (
              <div key={adm.id} className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5 text-xs">
                <div className="flex items-center justify-between font-bold text-[#0B1528]">
                  <span>{adm.name}</span>
                  <span className="font-mono text-[10px] text-[#0F766E]">{adm.freeLookWindow}</span>
                </div>
                <p className="mt-1 text-slate-600">{adm.directBypassTip}</p>
                <div className="mt-1.5 font-mono text-[11px] font-semibold text-[#0B1528]">{adm.contactHint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-amber-700">
            <Gavel className="h-3.5 w-3.5" /> Free Public Escalation Agencies
          </span>
          <h3 className="font-serif-display mt-1 text-xl font-bold text-[#0B1528]">
            If a Dealer Stalls Past 14 Days
          </h3>
          <div className="mt-4 space-y-3">
            {(refData?.resources || []).map((r: any, idx: number) => (
              <a
                key={idx}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5 transition hover:border-[#0F766E] hover:bg-teal-50/40"
              >
                <div className="flex items-center justify-between text-xs font-extrabold text-[#0B1528]">
                  <span>{r.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#0F766E]" />
                </div>
                <div className="text-[11px] font-semibold text-[#0F766E]">{r.role}</div>
                <p className="mt-1 text-xs text-slate-600">{r.whenToUse}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const NumField: React.FC<{
  label: string;
  value: number;
  step?: string;
  onChange: (v: number) => void;
}> = ({ label, value, step = '1', onChange }) => (
  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
    {label}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 font-mono text-sm text-[#0B1528] focus:border-[#0F766E] focus:bg-white focus:outline-none"
    />
  </label>
);

const TextField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
    {label}
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-[#0B1528]"
    />
  </label>
);

const ToggleCard: React.FC<{
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  cost: number;
  onCost: (v: number) => void;
}> = ({ label, checked, onToggle, cost, onCost }) => (
  <div
    className={`rounded-xl border p-3 transition ${
      checked ? 'border-[#0F766E] bg-teal-50/70' : 'border-slate-200 bg-[#FAF9F5]'
    }`}
  >
    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#0B1528]">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-[#0F766E]" />
      <span>{label}</span>
    </label>
    <div className="mt-2 flex items-center gap-1">
      <span className="text-xs font-bold text-slate-400">$</span>
      <input
        type="number"
        disabled={!checked}
        value={cost}
        onChange={(e) => onCost(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-bold text-[#0B1528] disabled:opacity-40"
      />
    </div>
  </div>
);
