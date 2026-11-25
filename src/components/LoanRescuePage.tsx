import React, { useMemo, useState } from 'react';
import {
  ArrowUp,
  Building2,
  ExternalLink,
  Gavel,
  HelpCircle,
  Lock,
  Scale,
  Search,
  CheckCircle2,
} from 'lucide-react';
import type { PublicAuditResponse } from '../shared/types';
import { AuditWorkspace } from './AuditWorkspace';
import { LockedGeneratorCard } from './LockedGeneratorCard';
import { PartnerCard } from './PartnerCard';

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

  // Prominent Warranty / GAP Provider Search & Selection
  const [providerQuery, setProviderQuery] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('fidelity-jma');
  const [customAdminName, setCustomAdminName] = useState('');
  const [showWhereToLook, setShowWhereToLook] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(defaultDate);
  const [stateCode, setStateCode] = useState('TX');
  const [currentLoanBalanceUsd, setCurrentLoanBalanceUsd] = useState(40500);
  const [estimatedVehicleValueUsd, setEstimatedVehicleValueUsd] = useState(30500);
  const [loanAprPct, setLoanAprPct] = useState(9.89);
  const [targetRefiAprPct, setTargetRefiAprPct] = useState(5.99);
  const [loanTermMonths, setLoanTermMonths] = useState(72);
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
  const [lenderName, setLenderName] = useState('');
  const [vehicleYmm, setVehicleYmm] = useState('');
  const [vin, setVin] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const [rescue, setRescue] = useState<any>(null);
  const [kit, setKit] = useState<PublicAuditResponse | null>(
    initialAudit && initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
  );
  const [loading, setLoading] = useState(false);

  // Legal Add-On Decoder & Directory Filter
  const [addonFilter, setAddonFilter] = useState<'ALL' | 'REQUIRED' | 'OPTIONAL' | 'CANCELLABLE'>('ALL');
  const [adminSearch, setAdminSearch] = useState('');

  const allAdmins = refData?.administrators || [];

  const matchingProviders = useMemo(() => {
    if (!providerQuery.trim()) return allAdmins.slice(0, 8);
    const q = providerQuery.toLowerCase();
    return allAdmins.filter(
      (a: any) => a.name.toLowerCase().includes(q) || a.products.toLowerCase().includes(q)
    );
  }, [allAdmins, providerQuery]);

  const activeProvider = useMemo(
    () => allAdmins.find((a: any) => a.id === selectedAdminId) ?? null,
    [allAdmins, selectedAdminId]
  );

  const resolvedAdminName =
    selectedAdminId === 'other'
      ? customAdminName.trim() || 'Plan Administrator Listed on Contract'
      : activeProvider?.name || 'Fidelity Warranty Services / JM&A Group';

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
    if (!adminSearch.trim()) return allAdmins;
    const q = adminSearch.toLowerCase();
    return allAdmins.filter(
      (a: any) => a.name.toLowerCase().includes(q) || a.products.toLowerCase().includes(q)
    );
  }, [allAdmins, adminSearch]);

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
          purchaseMileage: 40,
          currentMileage,
          financedInLoan,
          claimsFiled,
          items,
          buyerName,
          dealerName,
          administratorName: resolvedAdminName,
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

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-2" id="rescue-generator-top">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#05A66B]">
          Pillar 2 • 2-Step Car Loan Rescue &amp; Warranty Cancellation Generator
        </span>
        <h1 className="font-display text-3xl font-extrabold text-[#082545] sm:text-4xl">
          Search Your Extended Warranty / GAP Company &amp; Generate Your Cancellation Packet
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Dealership finance managers stall phone cancellations to protect their commission. Find the company housing your Extended Warranty or GAP contract below, calculate your exact free-look or prorated refund + LTV drop for free, and generate your ready-to-send direct cancellation letter &amp; PDF.
        </p>
      </div>

      {/* MAIN WARRANTY PROVIDER SEARCH + REFUND & LETTER GENERATOR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={runRescue} className="space-y-6">
          {/* PROMINENT STEP 1: SEARCH & SELECT EXTENDED WARRANTY / GAP COMPANY */}
          <div className="rounded-2xl border-2 border-[#05A66B]/30 bg-[#FAF9F5] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#05A66B]">
                  Step 1 • Identify Who Holds Your Warranty or GAP Contract
                </span>
                <h2 className="mt-0.5 text-lg font-extrabold text-[#082545]">
                  Search Extended Warranty / GAP Administrator ({allAdmins.length || 20} Major US Providers)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowWhereToLook(!showWhereToLook)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#05A66B] hover:underline"
              >
                <HelpCircle className="h-3.5 w-3.5" /> Where is this printed on my paperwork?
              </button>
            </div>

            {showWhereToLook && (
              <div className="mt-3 rounded-xl border border-teal-200 bg-white p-3.5 text-xs leading-relaxed text-slate-700">
                <strong className="text-[#082545]">Where to look (takes 30 seconds):</strong> Don't look at your dealership's logo — look at the separate <strong>Vehicle Service Contract (VSC)</strong> or <strong>GAP Addendum</strong> page in your finance folder. Check the top-left header or the very bottom fine print for <em>"Administered by..."</em> or <em>"Obligor:"</em> (common names: <strong>Fidelity, Safe-Guard, Ally, Zurich, Assurant, EasyCare, CNA National, Portfolio, Toyota TFS, Ford Protect, Honda Care</strong>). You can also upload your contract photo below and let our scanner read it for you!
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="relative md:col-span-5">
                <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={providerQuery}
                  onChange={(e) => setProviderQuery(e.target.value)}
                  placeholder="Type Fidelity, Safe-Guard, Ally, Zurich, Toyota..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs font-medium text-[#082545] focus:border-[#05A66B] focus:outline-none"
                />
              </div>

              <div className="md:col-span-7">
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-[#082545] focus:border-[#05A66B] focus:outline-none"
                >
                  {(providerQuery.trim() ? matchingProviders : allAdmins).map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — ({a.freeLookWindow})
                    </option>
                  ))}
                  <option value="other">Other / Regional Dealer Reinsurance (Enter Name Below)</option>
                </select>
              </div>
            </div>

            {selectedAdminId === 'other' ? (
              <div className="mt-3">
                <TextField
                  label="Enter Administrator / Warranty Company Name From Your Contract"
                  value={customAdminName}
                  onChange={setCustomAdminName}
                  placeholder="e.g. Vanguard Dealer Services / National Auto Care"
                />
              </div>
            ) : (
              activeProvider && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 font-extrabold text-[#082545]">
                      <CheckCircle2 className="h-4 w-4 text-[#05A66B]" />
                      {activeProvider.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      Covers: {activeProvider.products} • <strong>{activeProvider.freeLookWindow}</strong>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-mono text-[10.5px] font-bold text-[#082545] border border-emerald-200">
                    <Lock className="h-3 w-3 text-[#05A66B]" /> Direct Bypass Address &amp; Letter Ready
                  </span>
                </div>
              )
            )}
          </div>

          {/* STEP 2: LOAN & ADD-ON REFUND NUMBERS */}
          <div>
            <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Step 2 • Enter Loan &amp; Add-On Details (Free Refund &amp; LTV Calculation)
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Purchase Date
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#082545]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                State Purchased
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#082545]"
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
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Optional Add-Ons to Cancel:
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <ToggleCard label="Extended Warranty (VSC)" checked={vscOn} onToggle={setVscOn} cost={vscCost} onCost={setVscCost} />
              <ToggleCard label="Dealer GAP Waiver" checked={gapOn} onToggle={setGapOn} cost={gapCost} onCost={setGapCost} />
              <ToggleCard label="Tire, Wheel & Key" checked={tireOn} onToggle={setTireOn} cost={tireCost} onCost={setTireCost} />
              <ToggleCard label="Prepaid Maintenance" checked={maintOn} onToggle={setMaintOn} cost={maintCost} onCost={setMaintCost} />
            </div>
            <div className="mt-3 flex flex-wrap gap-5 text-xs font-medium text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={financedInLoan} onChange={(e) => setFinancedInLoan(e.target.checked)} className="accent-[#05A66B]" />
                Add-ons were financed in my auto loan
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={claimsFiled} onChange={(e) => setClaimsFiled(e.target.checked)} className="accent-amber-600" />
                I already filed a paid claim
              </label>
            </div>
          </div>

          {/* STEP 3: BUYER / CONTRACT DETAILS FOR LETTER GENERATION */}
          <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4">
            <div className="mb-2.5 text-xs font-extrabold text-[#082545]">
              Step 3 • Contract Details to Inject Into Your Generated Letter &amp; PDF (Optional Before Preview)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField label="Your Full Name" value={buyerName} onChange={setBuyerName} placeholder="Jordan Taylor" />
              <TextField label="Selling Dealership Name" value={dealerName} onChange={setDealerName} placeholder="Suncrest Motors" />
              <TextField label="Auto Lender / Lienholder" value={lenderName} onChange={setLenderName} placeholder="Capital One / Chase Auto" />
              <TextField label="Vehicle (Year Make Model)" value={vehicleYmm} onChange={setVehicleYmm} placeholder="2025 Honda CR-V Hybrid" />
              <TextField label="17-Digit VIN" value={vin} onChange={setVin} placeholder="2T3P1RFV..." />
              <TextField label="VSC / GAP Contract #" value={contractNumber} onChange={setContractNumber} placeholder="Contract or Policy #" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#05A66B] px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-[#048A58] disabled:opacity-50"
          >
            {loading
              ? 'Calculating Refund & Building Provider Cancellation Packet...'
              : `Calculate My Refund & Generate ${resolvedAdminName} Cancellation Kit`}
          </button>
        </form>

        {/* 2-STEP RESCUE RESULT + FEE-LOCKED LETTER GENERATOR */}
        {rescue && kit && (
          <div className="mt-7 space-y-6 border-t border-slate-200 pt-6">
            <div className="rounded-2xl bg-[#082545] p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 font-mono text-[11px] font-bold uppercase text-emerald-300">
                  {rescue.unlockedRefiEligibility ? '★ REFINANCE ELIGIBILITY UNLOCKED' : '2-STEP LOAN RESCUE PLAN'}
                </span>
                <span className="font-mono text-xs text-slate-300">
                  Provider: {resolvedAdminName}
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

            <LockedGeneratorCard
              kit={kit}
              onKitUpdated={setKit}
              headline={`Unlock Your ${resolvedAdminName} Direct Cancellation Letter, Routing Address & PDF`}
              subheadline="Every generated cancellation letter, direct administrator Cancellations Dept. address, Day-14 Dealer Stall-Buster notice & lender verification script is pre-filled and ready to sign."
              bullets={[
                `Exact Cancellations Dept. mailing address & direct-bypass rules for ${resolvedAdminName}`,
                'Pre-filled Formal Written Cancellation Notice (locks in your effective date & mileage)',
                'Day-14 Dealer Stall-Buster Escalation Letter (citing CFPB, State Insurance Dept. & State AG)',
                'Lender Principal-Application Verification Script + Downloadable Branded PDF Packet',
              ]}
              showCertifiedMailOption
            />

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
        customTitle="Not Sure What Was Rolled Into Your Loan? Upload Your Contract PDF / Photo"
        customSampleLabel="Try Sample Signed TILA Contract ($43,620)"
        initialAudit={
          initialAudit && !initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
        }
      />

      {/* SEARCHABLE 20-PROVIDER DIRECTORY (SELECT & GENERATE LETTER -> NO FREE BYPASS LEAK!) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#05A66B]">
                <Building2 className="h-3.5 w-3.5" /> Supported Warranty &amp; GAP Companies ({allAdmins.length})
              </span>
              <h3 className="font-display mt-1 text-xl font-extrabold text-[#082545]">
                Search Your Provider &amp; Load Into Letter Generator
              </h3>
            </div>
            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Filter 20 providers..."
                className="w-full rounded-lg border border-slate-300 bg-[#FAF9F5] py-1.5 pl-8 pr-2 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
            {filteredAdmins.map((adm: any) => (
              <div
                key={adm.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <div className="font-extrabold text-[#082545]">{adm.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-600">{adm.products}</div>
                  <div className="mt-1 font-mono text-[10.5px] font-semibold text-[#05A66B]">
                    {adm.freeLookWindow}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdminId(adm.id);
                    document
                      .getElementById('rescue-generator-top')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#082545] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#05A66B]"
                >
                  <ArrowUp className="h-3 w-3" /> Generate Letter
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-amber-700">
            <Gavel className="h-3.5 w-3.5" /> Free Public Escalation Agencies
          </span>
          <h3 className="font-display mt-1 text-xl font-extrabold text-[#082545]">
            If a Dealer Stalls Past 14 Days
          </h3>
          <div className="mt-4 space-y-3">
            {(refData?.resources || []).map((r: any, idx: number) => (
              <a
                key={idx}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5 transition hover:border-[#05A66B]"
              >
                <div className="flex items-center justify-between text-xs font-extrabold text-[#082545]">
                  <span>{r.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#05A66B]" />
                </div>
                <div className="text-[11px] font-semibold text-[#05A66B]">{r.role}</div>
                <p className="mt-1 text-xs text-slate-600">{r.whenToUse}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* LEGAL ADD-ON DECODER */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#05A66B]">
              <Scale className="h-3.5 w-3.5" /> Plain-English Legal Reference
            </span>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-[#082545]">
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
                    ? 'bg-[#082545] text-white'
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
                <h3 className="text-sm font-extrabold text-[#082545]">{a.name}</h3>
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
              <div className="mt-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[11px] text-slate-700">
                <strong className="text-[#05A66B]">Refund Rule: </strong>
                {a.cancellationNotes}
              </div>
            </div>
          ))}
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
      className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 font-mono text-sm text-[#082545] focus:border-[#05A66B] focus:bg-white focus:outline-none"
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
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-[#082545]"
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
      checked ? 'border-[#05A66B] bg-emerald-50/70' : 'border-slate-200 bg-[#FAF9F5]'
    }`}
  >
    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#082545]">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-[#05A66B]" />
      <span>{label}</span>
    </label>
    <div className="mt-2 flex items-center gap-1">
      <span className="text-xs font-bold text-slate-400">$</span>
      <input
        type="number"
        disabled={!checked}
        value={cost}
        onChange={(e) => onCost(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-bold text-[#082545] disabled:opacity-40"
      />
    </div>
  </div>
);
