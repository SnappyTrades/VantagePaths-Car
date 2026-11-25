import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AuditWorkspace } from './AuditWorkspace';
import { PartnerCard } from './PartnerCard';

/* =====================================================================
   PILLAR 3: ZERO-SPAM AUTO INSURANCE AUDIT & 6-MONTH RENEWAL HOOK
===================================================================== */
export const InsuranceAuditPage: React.FC<{ states: any[] }> = ({ states }) => {
  const [stateCode, setStateCode] = useState('TX');
  const [cur6, setCur6] = useState(1248);
  const [prev6, setPrev6] = useState(985);
  const [limits, setLimits] = useState('100/300/100');
  const [colDed, setColDed] = useState(250);
  const [compDed, setCompDed] = useState(250);
  const [roadside, setRoadside] = useState(true);
  const [rental, setRental] = useState(true);
  const [dealerGap, setDealerGap] = useState(true);
  const [vehicleYmm, setVehicleYmm] = useState('2024 Toyota RAV4 Hybrid XLE');
  const [result, setResult] = useState<any>(null);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // 6-Month Renewal Reminder Capture (Recurring Retention Revenue Layer!)
  const [remEmail, setRemEmail] = useState('');
  const [remMonth, setRemMonth] = useState('6 months before next renewal');
  const [remStatus, setRemStatus] = useState<string | null>(null);

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto/insurance-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateCode,
        currentSixMonthPremiumUsd: cur6,
        priorSixMonthPremiumUsd: prev6,
        biPdLimits: limits,
        collisionDeductibleUsd: colDed,
        compDeductibleUsd: compDed,
        hasRoadsideOnPolicy: roadside,
        hasRentalReimbursement: rental,
        hasDealerGapCurrently: dealerGap,
        vehicleYmm,
      }),
    });
    setResult(await res.json());
  };

  const saveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: remEmail,
        vertical: 'insurance-renewal',
        notes: `${stateCode} | ${remMonth} | $${cur6}/6mo`,
      }),
    });
    const data = await res.json();
    setRemStatus(data.message || 'Renewal alert saved!');
    setRemEmail('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
          Pillar 3 • Recurring Every-6-Months Savings
        </span>
        <h1 className="font-serif-display text-3xl font-bold text-[#0B1528] sm:text-4xl">
          Cut Your Auto Insurance Renewal Without Giving Away Your Phone Number
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Insurers systematically raise rates on loyal customers every 6–12 months. Audit your current Declarations Page here, catch deductible &amp; roadside traps, and generate a clean 1-page Apples-to-Apples Quote Spec Sheet to email agents with zero spam calls.
        </p>
      </div>

      {/* Policy Declarations Deterministic Analyzer */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={runAudit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              State
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              >
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <FieldNum label="New Renewal (6-mo $)" value={cur6} onChange={setCur6} />
            <FieldNum label="Prior Term (6-mo $)" value={prev6} onChange={setPrev6} />
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Liability Limits (BI/PD)
              <select
                value={limits}
                onChange={(e) => setLimits(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              >
                <option value="25/50/25">25/50/25 (State Min)</option>
                <option value="50/100/50">50/100/50</option>
                <option value="100/300/100">100/300/100 (Recommended)</option>
                <option value="250/500/100">250/500/100</option>
              </select>
            </label>
            <FieldNum label="Collision Deductible ($)" value={colDed} onChange={setColDed} />
            <FieldNum label="Comp Deductible ($)" value={compDed} onChange={setCompDed} />
            <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Vehicle (Year Make Model)
              <input
                type="text"
                value={vehicleYmm}
                onChange={(e) => setVehicleYmm(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-5 text-xs font-semibold text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={roadside} onChange={(e) => setRoadside(e.target.checked)} className="accent-[#0F766E]" />
              Roadside Assistance on policy
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={rental} onChange={(e) => setRental(e.target.checked)} className="accent-[#0F766E]" />
              Rental Reimbursement included
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={dealerGap} onChange={(e) => setDealerGap(e.target.checked)} className="accent-[#0F766E]" />
              Currently paying dealership GAP (replace with ~$5/mo insurer GAP!)
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#0F766E] px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#115E59]"
          >
            Audit My Policy &amp; Build Zero-Spam Apples-to-Apples Quote Spec (Free)
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-5 border-t border-slate-200 pt-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#0B1528] p-5 text-white sm:grid-cols-4">
              <div>
                <div className="text-[10.5px] uppercase text-slate-400">Annualized Spend</div>
                <div className="font-mono text-2xl font-extrabold">${result.annualPremiumUsd.toLocaleString()}/yr</div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase text-slate-400">Renewal Jump</div>
                <div className={`font-mono text-2xl font-extrabold ${result.loyaltyPenaltyFlag ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {result.renewalHikePct >= 0 ? `+${result.renewalHikePct}%` : `${result.renewalHikePct}%`}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase text-slate-400">Deductible Break-Even</div>
                <div className="font-mono text-2xl font-extrabold text-amber-300">
                  {result.deductibleBreakEvenMonths ? `${result.deductibleBreakEvenMonths} mos` : 'Optimized'}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase text-slate-400">Est. Annual Savings</div>
                <div className="font-mono text-2xl font-extrabold text-emerald-300">
                  ~${result.estimatedAnnualTotalSavingsUsd.toLocaleString()}/yr
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {result.flags.map((f: any, idx: number) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 text-xs ${
                    f.level === 'CRITICAL'
                      ? 'border-rose-200 bg-rose-50/70'
                      : 'border-amber-200 bg-amber-50/70'
                  }`}
                >
                  <div className="font-extrabold text-[#0B1528]">{f.title}</div>
                  <p className="mt-1 leading-relaxed text-slate-700">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* Copy-Paste Zero-Spam Spec Sheet */}
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F766E]">
                  Your 1-Page Zero-Spam Apples-to-Apples Email Quote Request
                </span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.zeroSpamQuoteSpecText);
                    setCopiedSpec(true);
                    setTimeout(() => setCopiedSpec(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0B1528] px-3 py-1.5 text-xs font-bold text-white"
                >
                  {copiedSpec ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSpec ? 'Copied!' : 'Copy Quote Spec'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-sans text-xs leading-relaxed text-slate-700">
                {result.zeroSpamQuoteSpecText}
              </pre>
            </div>
          </div>
        )}
      </section>

      {/* TRACKED AUTO INSURANCE AFFILIATE CTA (REVENUE LAYER 2) */}
      <PartnerCard
        partnerId="auto-insurance-compare"
        badge="Zero-Pressure Rate Check"
        title="Compare Apples-to-Apples Auto Insurance & Low-Cost Insurer GAP Quotes"
        subtitle="Use your exact coverage limits above to benchmark your renewal rate across top carriers — and replace $1,200 dealer GAP for ~$5/mo."
        ctaLabel="Compare Insurance Rates"
        source="insurance_pillar"
        accent="navy"
      />

      {/* UPLOAD DECLARATIONS PAGE PDF/PHOTO AUDITOR */}
      <AuditWorkspace
        vertical="auto"
        sampleVariant="insurance-dec"
        customBadge="AI Declarations Page PDF/Photo Scanner"
        customTitle="Or Drop Your Insurance Declarations Page PDF / Photo for an Instant Line-Item Audit"
        customSampleLabel="Try Sample Auto Declarations Page ($2,496/yr)"
        customPlaceholder="Paste your current auto insurance Declarations Page coverages, deductibles, and renewal premium..."
      />

      {/* 6-MONTH RENEWAL REMINDER RETENTION ENGINE */}
      <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#0F766E]">
              <Bell className="h-3.5 w-3.5" /> Beat the 6-Month Loyalty Penalty Automatically
            </span>
            <h3 className="font-serif-display mt-1 text-xl font-bold text-[#0B1528]">
              Get a Free 30-Day Pre-Renewal Alert Before Your Rate Quietly Jumps Again
            </h3>
          </div>
          <form onSubmit={saveReminder} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={remEmail}
              onChange={(e) => setRemEmail(e.target.value)}
              placeholder="you@email.com"
              className="rounded-xl border border-teal-300 bg-white px-4 py-2.5 text-xs text-[#0B1528] focus:border-[#0F766E] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#0B1528] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#0F766E]"
            >
              Set Renewal Alert
            </button>
          </form>
        </div>
        {remStatus && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
            <CheckCircle2 className="h-4 w-4" /> {remStatus}
          </div>
        )}
      </section>
    </div>
  );
};

/* =====================================================================
   PILLAR 4: SELL OR TRADE IN FOR MAX CASH
===================================================================== */
export const SellOrTradePage: React.FC<{ states: any[] }> = ({ states }) => {
  const [stateCode, setStateCode] = useState('TX');
  const [dealerTrade, setDealerTrade] = useState(16500);
  const [instantCash, setInstantCash] = useState(18400);
  const [privateVal, setPrivateVal] = useState(19800);
  const [loanPayoff, setLoanPayoff] = useState(9500);
  const [buyingNext, setBuyingNext] = useState(true);
  const [result, setResult] = useState<any>(null);

  const runCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto/sell-exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateCode,
        dealerTradeInOfferUsd: dealerTrade,
        instantCashOfferUsd: instantCash,
        privatePartyValueUsd: privateVal,
        loanPayoffUsd: loanPayoff,
        buyingReplacementCar: buyingNext,
      }),
    });
    setResult(await res.json());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
          Pillar 4 • Max-Cash Car Exit Optimizer
        </span>
        <h1 className="font-serif-display text-3xl font-bold text-[#0B1528] sm:text-4xl">
          Don't Leave \$2,500 on the Table When Trading In or Selling Your Car
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          In 40+ states, trading in saves you hundreds or thousands in sales tax — while in states like California, Virginia, and Oklahoma, selling privately or to an instant cash buyer wins outright. Compare all 3 exit paths with exact tax math.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={runCalc} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Your State
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              >
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <FieldNum label="Dealer Trade Offer ($)" value={dealerTrade} onChange={setDealerTrade} />
            <FieldNum label="Instant Cash Offer ($)" value={instantCash} onChange={setInstantCash} />
            <FieldNum label="Private Sale Value ($)" value={privateVal} onChange={setPrivateVal} />
            <FieldNum label="Current Loan Payoff ($)" value={loanPayoff} onChange={setLoanPayoff} />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={buyingNext} onChange={(e) => setBuyingNext(e.target.checked)} className="accent-[#0F766E]" />
            I am buying a replacement car at the dealership (triggers state trade-in sales tax credit where legal)
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#0F766E] px-6 py-3 text-sm font-extrabold text-white hover:bg-[#115E59]"
          >
            Compare Trade-In Tax Credit vs. Instant Cash vs. Private Sale
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
            <div className="rounded-xl bg-[#0B1528] p-5 text-white">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Winning Exit Path in {result.stateName}: {result.bestPath.replace('_', ' ')} (+${result.advantageOverWorstUsd.toLocaleString()} vs Worst Option)
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{result.recommendation}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <PathBox
                title="Dealer Trade-In (After Tax Credit)"
                val={result.dealerTradeEffectiveUsd}
                sub={`$${dealerTrade.toLocaleString()} offer + $${result.tradeInTaxSavingsUsd.toLocaleString()} tax savings`}
                winner={result.bestPath === 'DEALER_TRADE'}
              />
              <PathBox
                title="Online Instant Cash Offer"
                val={result.instantCashEffectiveUsd}
                sub="Zero flaky buyers — use as dealer trade-in leverage too"
                winner={result.bestPath === 'INSTANT_CASH'}
              />
              <PathBox
                title="Private Party Sale"
                val={result.privatePartyEffectiveUsd}
                sub={`Must beat $${result.privateBreakEvenOverTradeUsd.toLocaleString()} to top dealer trade-in`}
                winner={result.bestPath === 'PRIVATE_SALE'}
              />
            </div>
          </div>
        )}
      </section>

      <PartnerCard
        partnerId="instant-cash-offer"
        badge="Zero-Hassle Valuation Floor"
        title="Grab a Real Online Instant Cash Offer in 2 Minutes Before Visiting a Dealer"
        subtitle="Print your online cash offer and hand it to the sales manager — either they match it (plus give you your state sales tax credit) or you sell straight online."
        ctaLabel="Check Instant Cash Offer"
        source="sell_pillar"
        accent="teal"
      />

      {/* Zero-Scam Private Sale Safety Checklist */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="font-mono text-[11px] font-bold uppercase text-[#0F766E]">
          Zero-Scam Private Sale Playbook
        </span>
        <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
          4 Rules to Sell Privately Without Getting Scammed
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <CheckItem title="1. Meet Inside the Buyer's Bank Branch for Payment" body="Never accept screenshots, Zelle/Venmo from strangers, or mailed cashier's checks. Watch the bank teller print the cashier's check or wire funds directly." />
          <CheckItem title="2. Refuse 'Fake VIN Report' Phishing Scams" body="Facebook Marketplace bots ask you to buy a $35 report on a shady site. Only ever provide Carfax/AutoCheck or our free NHTSA VIN check." />
          <CheckItem title="3. Sign a State-Specific 'As-Is' Bill of Sale" body="List exact odometer reading, VIN, purchase price, date/time, and 'Sold AS-IS with no warranty expressed or implied' signed by both parties." />
          <CheckItem title="4. File DMV Release of Liability the Same Day" body="Keep your license plates (in plate-to-owner states) and submit your state's online Notice of Transfer/Release of Liability immediately so tolls & tickets don't follow you." />
        </div>
      </section>
    </div>
  );
};

/* =====================================================================
   51-STATE CAR BUYER LAW & "RETURN MYTH" SEO HUB (/states & /state/:code)
===================================================================== */
export const StatesLawHubPage: React.FC<{
  states: any[];
  selectedCode?: string | null;
  navigate: (path: string) => void;
}> = ({ states, selectedCode, navigate }) => {
  const [query, setQuery] = useState('');
  const activeState = useMemo(() => {
    if (!selectedCode) return null;
    return states.find((s) => s.code.toLowerCase() === selectedCode.toLowerCase()) ?? null;
  }, [states, selectedCode]);

  const filtered = useMemo(() => {
    if (!query.trim()) return states;
    const q = query.toLowerCase();
    return states.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [states, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      {activeState ? (
        <div className="space-y-6">
          <button
            onClick={() => navigate('/states')}
            className="text-xs font-bold text-[#0F766E] hover:underline"
          >
            ← All 50 States + DC Directory
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-[#0F766E]">
              <MapPin className="h-3.5 w-3.5" /> {activeState.name} ({activeState.code}) Car Buyer Laws &amp; Fee Caps
            </span>
            <h1 className="font-serif-display mt-3 text-3xl font-bold text-[#0B1528]">
              Buying or Cancelling Car Add-Ons in {activeState.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{activeState.notes}</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <StatCard
                label="Statutory Doc Fee Cap"
                val={activeState.docFeeCapUsd !== null ? `$${activeState.docFeeCapUsd} Max` : `Uncapped (~$${activeState.typicalDocFeeUsd})`}
                good={activeState.docFeeCapUsd !== null}
              />
              <StatCard
                label="Trade-In Tax Credit"
                val={activeState.tradeInTaxCredit ? 'YES — Full Credit' : 'NO Tax Credit'}
                good={activeState.tradeInTaxCredit}
              />
              <StatCard
                label="VSC Free-Look Window"
                val={`${activeState.vscFreeLookDays} Days (100%)`}
                good={true}
              />
              <StatCard
                label="Max Cancellation Admin Fee"
                val={`$${activeState.vscMaxAdminFeeUsd} Cap`}
                good={true}
              />
            </div>

            {/* THE "3-DAY RETURN MYTH" SEO FUNNEL -> PILLAR 2 LOAN RESCUE! */}
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="text-base font-extrabold text-[#0B1528]">
                    "Can I Return a Car I Bought Yesterday in {activeState.name}?" (The 3-Day Myth)
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {activeState.code === 'CA'
                      ? 'California does NOT have an automatic free 3-day return law — only an optional paid 2-day cancellation contract on used cars under $40,000. However, CA gives you a powerful 60-day full refund window on Extended Warranties & GAP!'
                      : `Like 49 other US states, ${activeState.name} has NO automatic 3-day "cooling-off" right to return a car once signed. BUT you DO have the legal right to cancel overpriced Extended Warranties, GAP, and F&I add-ons (100% refund inside ${activeState.vscFreeLookDays} days, prorated after) and refinance a marked-up dealer APR!`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate('/rescue')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#115E59]"
                    >
                      Run 2-Step Loan Rescue &amp; Cancel Add-Ons <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => navigate('/buy')}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#0B1528]"
                    >
                      Launch {activeState.name} Remote Bid-War
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                50 States + DC Reference Hub
              </span>
              <h1 className="font-serif-display mt-1 text-3xl font-bold text-[#0B1528]">
                State-by-State Dealer Doc Fee Caps, Tax Credits &amp; Cancellation Laws
              </h1>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter state (e.g. Texas, FL)..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-[#0B1528]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <button
                key={s.code}
                onClick={() => navigate(`/state/${s.code}`)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-[#0F766E] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#0B1528]">
                    {s.name} ({s.code})
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      s.docFeeCapUsd !== null
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {s.docFeeCapUsd !== null ? `$${s.docFeeCapUsd} Cap` : 'Uncapped Doc'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span>Trade Credit: <strong>{s.tradeInTaxCredit ? 'Yes' : 'No'}</strong></span>
                  <span>•</span>
                  <span>VSC Free-Look: <strong>{s.vscFreeLookDays}d</strong></span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const FieldNum: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
    {label}
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 font-mono text-sm text-[#0B1528] focus:border-[#0F766E] focus:bg-white focus:outline-none"
    />
  </label>
);

const PathBox: React.FC<{ title: string; val: number; sub: string; winner: boolean }> = ({
  title,
  val,
  sub,
  winner,
}) => (
  <div
    className={`rounded-xl border p-4 ${
      winner ? 'border-[#0F766E] bg-teal-50/70 shadow-sm' : 'border-slate-200 bg-[#FAF9F5]'
    }`}
  >
    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
      <span>{title}</span>
      {winner && <span className="rounded-full bg-[#0F766E] px-2 py-0.5 text-[10px] text-white">WINNER</span>}
    </div>
    <div className="mt-1 font-mono text-2xl font-extrabold text-[#0B1528]">${val.toLocaleString()}</div>
    <div className="mt-1 text-[11px] text-slate-600">{sub}</div>
  </div>
);

const CheckItem: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4">
    <div className="flex items-center gap-2 text-sm font-extrabold text-[#0B1528]">
      <ShieldCheck className="h-4 w-4 shrink-0 text-[#0F766E]" /> {title}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
  </div>
);

const StatCard: React.FC<{ label: string; val: string; good: boolean }> = ({ label, val, good }) => (
  <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4">
    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`mt-1 font-mono text-base font-extrabold ${good ? 'text-[#0F766E]' : 'text-amber-700'}`}>
      {val}
    </div>
  </div>
);
