import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  Gavel,
  Lock,
  MessageSquareQuote,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type { PublicAuditResponse } from '../shared/types';
import { AuditWorkspace } from './AuditWorkspace';
import { downloadAuditPdf } from '../utils/pdfExport';

type AutoStage = 'before' | 'during' | 'after';

interface AutoAddOnItem {
  id: string;
  name: string;
  shortLabel: string;
  category: 'STATUTORY' | 'DEALER_FEE' | 'FI_ADDON' | 'LEASE_FEE';
  legallyRequired: 'REQUIRED' | 'OPTIONAL' | 'CONDITIONAL';
  typicalDealerPrice: string;
  realMarketCost: string;
  cancellableAfterPurchase: 'YES_FULL_OR_PRORATED' | 'PARTIAL_OR_DISPUTABLE' | 'NO';
  plainEnglish: string;
  dealerPitch: string;
  yourRebuttal: string;
  cancellationNotes: string;
}

interface StateAutoRule {
  code: string;
  name: string;
  docFeeCapUsd: number | null;
  typicalDocFeeUsd: number;
  tradeInTaxCredit: boolean;
  typicalSalesTaxPct: number;
  vscFreeLookDays: number;
  vscMaxAdminFeeUsd: number;
  notes: string;
}

interface FiAdministratorInfo {
  id: string;
  name: string;
  products: string;
  freeLookWindow: string;
  directBypassTip: string;
  requiredDocs: string[];
  contactHint: string;
}

interface ConsumerResource {
  name: string;
  role: string;
  whenToUse: string;
  url: string;
}

interface ReferencePayload {
  addons: AutoAddOnItem[];
  states: StateAutoRule[];
  administrators: FiAdministratorInfo[];
  resources: ConsumerResource[];
}

interface Props {
  initialAudit?: PublicAuditResponse | null;
}

const DEALER_REBUTTALS = [
  {
    pitch: '"The lender requires GAP / Extended Warranty to approve this interest rate."',
    truth: 'ILLEGAL TIED SELLING (Federal Law / TILA)',
    script:
      '"Tying loan approval or an APR to purchasing an optional warranty or GAP violates federal law. Please show me the lender\'s written stipulation or remove the add-on so we can proceed."',
  },
  {
    pitch: '"Paint protection / nitrogen / pulse brake lights are already installed on every car — we can\'t remove them."',
    truth: '100% Optional Dealer Profit Packing',
    script:
      '"I didn\'t ask for those packages. If you physically can\'t remove them, simply discount the vehicle selling price by the exact same dollar amount so my Out-The-Door total stays clean."',
  },
  {
    pitch: '"What monthly payment are you trying to stay under today?"',
    truth: 'Classic 4-Square Trap (Hides APR, Term & Add-Ons)',
    script:
      '"I only negotiate on the itemized Out-The-Door price — selling price, doc fee, tax, and DMV fees. Once we agree on OTD, we\'ll talk financing separately."',
  },
  {
    pitch: '"We don\'t email Out-The-Door worksheets or let buyers take them off the lot."',
    truth: 'Designed to Stop You From Shopping Competing Dealers',
    script:
      '"No problem — I\'m emailing 4 competing dealers today and buying from whichever store sends a transparent itemized OTD quote. Let me know if you want to compete."',
  },
  {
    pitch: '"To cancel your extended warranty or GAP, you have to come back in person and meet with our finance manager."',
    truth: 'Common Stall Tactic to Protect F&I Commission',
    script:
      '"My contract allows written cancellation directly with the plan administrator. I\'m sending my signed notice + odometer photo to both your F&I Director and the administrator today to lock in my effective date."',
  },
];

const THREE_DEALER_EMAIL_SCRIPT = `Subject: Ready to Buy This Week — Requesting Itemized Out-The-Door Quote ([Year Make Model Trim])

Hi Internet Sales Manager,

I am ready to purchase a [Year Make Model Trim, e.g., 2026 Toyota RAV4 Hybrid XLE] in [Color Preferences] within the next 7 days and already have pre-approved financing arranged.

I am contacting 4 dealerships in our area and will buy from the store that sends the cleanest, most transparent written Out-The-Door (OTD) quote. Please reply with an itemized breakdown showing:
1. Vehicle Selling Price (before tax/fees)
2. Any dealer-installed add-ons (I am declining paint/nitrogen/VIN etch/security packages)
3. Dealer Documentation Fee
4. Estimated Sales Tax (for ZIP [YOUR ZIP]) & Government Title/Reg Fees
5. Total Out-The-Door Price

Please keep all communication via email until we agree on the OTD number. If your OTD quote is competitive, I can place a deposit and come sign immediately.

Thank you,
[Your Name]`;

export const AutoAdvantageHub: React.FC<Props> = ({ initialAudit = null }) => {
  const [stage, setStage] = useState<AutoStage>('before');
  const [refData, setRefData] = useState<ReferencePayload | null>(null);

  // Stage 1: Add-on filter + Path Optimizer + Email copy
  const [addonFilter, setAddonFilter] = useState<'ALL' | 'REQUIRED' | 'OPTIONAL' | 'CANCELLABLE'>('ALL');
  const [addonSearch, setAddonSearch] = useState('');
  const [copiedBlast, setCopiedBlast] = useState(false);

  const [selectedState, setSelectedState] = useState('TX');
  const [pathPrice, setPathPrice] = useState(38000);
  const [pathDown, setPathDown] = useState(4000);
  const [pathTrade, setPathTrade] = useState(14000);
  const [pathPayoff, setPathPayoff] = useState(6000);
  const [pathTerm, setPathTerm] = useState(60);
  const [promoApr, setPromoApr] = useState(1.9);
  const [cashRebate, setCashRebate] = useState(3000);
  const [cuApr, setCuApr] = useState(5.79);
  const [pathResult, setPathResult] = useState<any>(null);

  // Stage 2: Four-Square Reverse Calculator
  const [fsPrice, setFsPrice] = useState(36500);
  const [fsDown, setFsDown] = useState(4000);
  const [fsTax, setFsTax] = useState(7.25);
  const [fsFees, setFsFees] = useState(550);
  const [fsTerm, setFsTerm] = useState(72);
  const [fsQuotedMonthly, setFsQuotedMonthly] = useState(689);
  const [fsFairApr, setFsFairApr] = useState(5.9);
  const [fsResult, setFsResult] = useState<any>(null);

  // Stage 3: Post-Purchase Add-On Refund & Cancellation Kit
  const defaultPurchaseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    return d.toISOString().slice(0, 10);
  }, []);
  const [purchaseDate, setPurchaseDate] = useState(defaultPurchaseDate);
  const [refundState, setRefundState] = useState('TX');
  const [financedInLoan, setFinancedInLoan] = useState(true);
  const [loanApr, setLoanApr] = useState(8.89);
  const [loanTerm, setLoanTerm] = useState(72);
  const [purchaseMileage, setPurchaseMileage] = useState(45);
  const [currentMileage, setCurrentMileage] = useState(1180);
  const [claimsFiled, setClaimsFiled] = useState(false);

  const [vscOn, setVscOn] = useState(true);
  const [vscCost, setVscCost] = useState(3495);
  const [gapOn, setGapOn] = useState(true);
  const [gapCost, setGapCost] = useState(1195);
  const [tireOn, setTireOn] = useState(true);
  const [tireCost, setTireCost] = useState(895);
  const [maintOn, setMaintOn] = useState(false);
  const [maintCost, setMaintCost] = useState(1100);
  const [paintOn, setPaintOn] = useState(false);
  const [paintCost, setPaintCost] = useState(1295);

  const [buyerName, setBuyerName] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [adminName, setAdminName] = useState('Fidelity Warranty Services / JM&A');
  const [lenderName, setLenderName] = useState('');
  const [vehicleYmm, setVehicleYmm] = useState('');
  const [vin, setVin] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const [refundEstimate, setRefundEstimate] = useState<any>(null);
  const [refundKit, setRefundKit] = useState<PublicAuditResponse | null>(
    initialAudit && initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
  );
  const [refundLoading, setRefundLoading] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState(false);
  const [adminQuery, setAdminQuery] = useState('');

  useEffect(() => {
    fetch('/api/auto/reference')
      .then((r) => r.json())
      .then((data) => setRefData(data as ReferencePayload))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialAudit?.auditId.startsWith('vp_autorefund_')) {
      setStage('after');
      setRefundKit(initialAudit);
    }
  }, [initialAudit]);

  const currentStateRule = useMemo(() => {
    return refData?.states.find((s) => s.code === selectedState) ?? null;
  }, [refData, selectedState]);

  const filteredAddons = useMemo(() => {
    if (!refData) return [];
    return refData.addons.filter((item) => {
      if (addonFilter === 'REQUIRED' && item.legallyRequired !== 'REQUIRED') return false;
      if (addonFilter === 'OPTIONAL' && item.legallyRequired !== 'OPTIONAL') return false;
      if (addonFilter === 'CANCELLABLE' && item.cancellableAfterPurchase === 'NO') return false;
      if (addonSearch.trim()) {
        const q = addonSearch.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.plainEnglish.toLowerCase().includes(q) ||
          item.dealerPitch.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [refData, addonFilter, addonSearch]);

  const filteredAdmins = useMemo(() => {
    if (!refData) return [];
    if (!adminQuery.trim()) return refData.administrators;
    const q = adminQuery.toLowerCase();
    return refData.administrators.filter(
      (a) => a.name.toLowerCase().includes(q) || a.products.toLowerCase().includes(q)
    );
  }, [refData, adminQuery]);

  const runPathCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto/path-compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehiclePriceUsd: pathPrice,
        downPaymentUsd: pathDown,
        tradeInValueUsd: pathTrade,
        tradeInPayoffUsd: pathPayoff,
        stateCode: selectedState,
        termMonths: pathTerm,
        promoAprPct: promoApr,
        cashRebateUsd: cashRebate,
        creditUnionAprPct: cuApr,
      }),
    });
    setPathResult(await res.json());
  };

  const runFourSquare = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto/four-square', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehiclePriceUsd: fsPrice,
        downOrTradeUsd: fsDown,
        salesTaxPct: fsTax,
        titleRegDocUsd: fsFees,
        termMonths: fsTerm,
        dealerQuotedMonthlyUsd: fsQuotedMonthly,
        expectedFairAprPct: fsFairApr,
      }),
    });
    setFsResult(await res.json());
  };

  const runRefundEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = [
      vscOn ? { type: 'vsc', label: 'Extended Warranty (VSC)', costUsd: vscCost, contractTermMonths: 72 } : null,
      gapOn ? { type: 'gap', label: 'GAP Waiver / Insurance', costUsd: gapCost, contractTermMonths: loanTerm } : null,
      tireOn ? { type: 'tire_wheel', label: 'Tire, Wheel & Key Protection', costUsd: tireCost, contractTermMonths: 60 } : null,
      maintOn ? { type: 'maintenance', label: 'Prepaid Maintenance Plan', costUsd: maintCost, contractTermMonths: 48 } : null,
      paintOn ? { type: 'paint_fabric', label: 'Paint / Fabric Protection', costUsd: paintCost, contractTermMonths: 60 } : null,
    ].filter(Boolean);

    if (items.length === 0) return;
    setRefundLoading(true);
    try {
      const res = await fetch('/api/auto/refund-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseDateIso: purchaseDate,
          stateCode: refundState,
          financedInLoan,
          loanAprPct: loanApr,
          loanTermMonths: loanTerm,
          purchaseMileage,
          currentMileage,
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
      setRefundEstimate(data.estimate);
      setRefundKit(data.kit);
    } finally {
      setRefundLoading(false);
    }
  };

  const handleUnlockKit = async (tier: 'pass' | 'pro') => {
    if (!refundKit) return;
    setUnlockLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: refundKit.auditId, tier }),
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
          body: JSON.stringify({ auditId: refundKit.auditId }),
        });
        setRefundKit((await uRes.json()) as PublicAuditResponse);
      }
    } finally {
      setUnlockLoading(false);
    }
  };

  const roiMultiplier =
    refundKit && refundKit.pricing.passPriceUsd > 0
      ? Math.max(1, Math.round(refundKit.estimatedSavingsUsd / refundKit.pricing.passPriceUsd))
      : 0;

  return (
    <div className="space-y-8">
      {/* Informational Self-Service Clarity Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sky-400" />
          <span>
            <strong>100% Independent Informational Self-Service Toolkit:</strong> Know what is legally required, compare deal paths with math, and generate your own ready-to-send emails & cancellation letters. <em>You stay in full control — VantagePaths never contacts dealers on your behalf or acts as your legal representative.</em>
          </span>
        </div>
      </div>

      {/* 3-Stage Advantage Journey Switcher */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StageTab
          active={stage === 'before'}
          step="STAGE 1 • BEFORE YOU BUY"
          title="Prep, Legal Fees & Best Path"
          desc="No dealer sheet needed. See what's legally required, state doc caps, Promo APR vs. Rebate, and force written OTD quotes."
          onClick={() => setStage('before')}
        />
        <StageTab
          active={stage === 'during'}
          step="STAGE 2 • AT THE DEALERSHIP"
          title="Live Desk Defense & BS-Detector"
          desc="Decode a 4-square monthly payment in 10 seconds, shut down F&I pressure scripts, or snap a worksheet photo."
          onClick={() => setStage('during')}
        />
        <StageTab
          active={stage === 'after'}
          step="STAGE 3 • ALREADY BOUGHT?"
          title="Contract Breakdown & Add-On Refunds"
          desc="Cancel extended warranties, GAP & add-ons for cash or principal reduction, bypass stalling dealers, and break down your TILA contract."
          badge="HIGHEST ROI"
          onClick={() => setStage('after')}
        />
      </div>

      {/* ================================================================= */}
      {/* STAGE 1: BEFORE YOU BUY                                           */}
      {/* ================================================================= */}
      {stage === 'before' && (
        <div className="space-y-8">
          {/* 1A: Legal Fee & Add-On Decoder */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
                  <Scale className="h-3.5 w-3.5" /> Dealership Fee & Add-On Legal Decoder
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">
                  What Every Add-On Actually Is — And Whether It's Legally Required
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Only <strong>State Sales Tax</strong> and <strong>Government DMV Title/Registration</strong> are legally required to buy a car. Every F&I add-on (Warranty, GAP, Paint, Nitrogen, VIN Etch) is <strong>100% optional</strong>.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={addonSearch}
                  onChange={(e) => setAddonSearch(e.target.value)}
                  placeholder="Search GAP, doc fee, warranty..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ['ALL', 'All Fees & Add-Ons (13)'],
                  ['REQUIRED', 'Legally Required Only'],
                  ['OPTIONAL', '100% Optional (Say No)'],
                  ['CANCELLABLE', 'Cancellable After Signing'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAddonFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    addonFilter === key
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredAddons.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/75 p-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.legallyRequired === 'REQUIRED'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : item.legallyRequired === 'CONDITIONAL'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {item.legallyRequired === 'REQUIRED'
                            ? 'Legally Required'
                            : item.legallyRequired === 'CONDITIONAL'
                            ? 'Not Statutory (Check Cap)'
                            : '100% Optional'}
                        </span>
                        {item.cancellableAfterPurchase === 'YES_FULL_OR_PRORATED' && (
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                            Cancellable for Refund
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">Typical Dealer Charge: </span>
                        <span className="font-mono font-semibold text-rose-300">{item.typicalDealerPrice}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">True Market Cost: </span>
                        <span className="font-mono font-semibold text-emerald-300">{item.realMarketCost}</span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-300">{item.plainEnglish}</p>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[11px]">
                      <div className="text-slate-400">
                        <strong className="text-amber-300">Dealer says:</strong> {item.dealerPitch}
                      </div>
                      <div className="mt-1 text-slate-200">
                        <strong className="text-emerald-400">Your move:</strong> {item.yourRebuttal}
                      </div>
                    </div>
                  </div>

                  {item.cancellableAfterPurchase !== 'NO' && (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-[11px] text-sky-300">
                      <span>{item.cancellationNotes}</span>
                      <button
                        onClick={() => setStage('after')}
                        className="shrink-0 rounded-lg bg-sky-500/15 px-2.5 py-1 font-semibold text-sky-300 hover:bg-sky-500/25"
                      >
                        Cancel Tool →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 1B: 50-State Rules + Promo APR vs Cash Rebate Path Optimizer */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Calculator className="h-3.5 w-3.5" /> Which Deal Path Gives You the Most Advantage?
            </span>
            <h2 className="mt-1 text-xl font-bold text-white">
              50-State Doc Fee Cap, Trade-In Tax Credit & Promo APR vs. Cash Rebate Optimizer
            </h2>

            {currentStateRule && (
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:grid-cols-4">
                <MiniStat
                  label={`${currentStateRule.name} Doc Fee Cap`}
                  value={
                    currentStateRule.docFeeCapUsd !== null
                      ? `$${currentStateRule.docFeeCapUsd} Statutory Max`
                      : `UNCAPPED (~$${currentStateRule.typicalDocFeeUsd} avg)`
                  }
                  accent={currentStateRule.docFeeCapUsd !== null ? 'text-emerald-400' : 'text-amber-300'}
                />
                <MiniStat
                  label="Trade-In Sales Tax Credit"
                  value={currentStateRule.tradeInTaxCredit ? 'YES — Saves Tax!' : 'NO Credit (Sell Privately!)'}
                  accent={currentStateRule.tradeInTaxCredit ? 'text-emerald-400' : 'text-rose-300'}
                />
                <MiniStat
                  label="VSC Free-Look / Max Fee"
                  value={`${currentStateRule.vscFreeLookDays} Days / $${currentStateRule.vscMaxAdminFeeUsd} Cap`}
                  accent="text-sky-300"
                />
                <div className="text-xs text-slate-300">{currentStateRule.notes}</div>
              </div>
            )}

            <form onSubmit={runPathCompare} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Your State (Registration)
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {(refData?.states || []).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>
              <NumField label="Vehicle Price ($)" value={pathPrice} onChange={setPathPrice} />
              <NumField label="Cash Down ($)" value={pathDown} onChange={setPathDown} />
              <NumField label="Trade-In Value ($)" value={pathTrade} onChange={setPathTrade} />
              <NumField label="Trade-In Payoff ($)" value={pathPayoff} onChange={setPathPayoff} />
              <NumField label="Loan Term (mos)" value={pathTerm} onChange={setPathTerm} />
              <NumField label="Dealer Promo APR (%)" value={promoApr} step="0.1" onChange={setPromoApr} />
              <NumField label="OR Cash Rebate ($)" value={cashRebate} onChange={setCashRebate} />
              <NumField label="Credit Union APR (%)" value={cuApr} step="0.05" onChange={setCuApr} />
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Compare Paths
                </button>
              </div>
            </form>

            {pathResult && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-emerald-400">{pathResult.summary}</div>
                  {pathResult.tradeInTaxSavingsUsd > 0 && (
                    <span className="rounded-lg bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300">
                      Trade-In Tax Credit Saves ${pathResult.tradeInTaxSavingsUsd.toLocaleString()} (Private sale must beat ${pathResult.privateSaleBreakEvenUsd.toLocaleString()})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-xl border p-3.5 ${
                      pathResult.winner === 'PROMO_APR'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase text-slate-400">
                      Path A: {promoApr}% Promo APR {pathResult.winner === 'PROMO_APR' && '★ WINNER'}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold text-white">
                      ${pathResult.promoPath.monthlyUsd}/mo • Total ${pathResult.promoPath.totalCostUsd.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">
                      Financed: ${pathResult.promoPath.amountFinancedUsd.toLocaleString()} | Total Interest: ${pathResult.promoPath.totalInterestUsd.toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl border p-3.5 ${
                      pathResult.winner === 'CASH_REBATE'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase text-slate-400">
                      Path B: ${cashRebate.toLocaleString()} Rebate + {cuApr}% CU Loan{' '}
                      {pathResult.winner === 'CASH_REBATE' && '★ WINNER'}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold text-white">
                      ${pathResult.rebatePath.monthlyUsd}/mo • Total ${pathResult.rebatePath.totalCostUsd.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">
                      Financed: ${pathResult.rebatePath.amountFinancedUsd.toLocaleString()} | Total Interest: ${pathResult.rebatePath.totalInterestUsd.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 1C: Force Written OTD Quotes Email Template */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Free Pre-Visit Weapon
                </span>
                <h2 className="mt-1 text-lg font-bold text-white">
                  Dealers Won't Give You a PO in Person? Use This 4-Dealer Email OTD Script First
                </h2>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(THREE_DEALER_EMAIL_SCRIPT);
                  setCopiedBlast(true);
                  setTimeout(() => setCopiedBlast(false), 2200);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
              >
                {copiedBlast ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedBlast ? 'Copied to Clipboard!' : 'Copy Email Script'}
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 font-sans text-xs leading-relaxed text-slate-300">
              {THREE_DEALER_EMAIL_SCRIPT}
            </pre>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* STAGE 2: AT THE DEALERSHIP (LIVE DESK DEFENSE)                    */}
      {/* ================================================================= */}
      {stage === 'during' && (
        <div className="space-y-8">
          {/* 2A: 4-Square Monthly Payment BS-Detector */}
          <section className="rounded-2xl border border-sky-500/35 bg-slate-900/80 p-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <ShieldAlert className="h-3.5 w-3.5" /> No Deal Sheet? No Problem.
            </span>
            <h2 className="mt-1 text-xl font-bold text-white">
              Four-Square Monthly Payment BS-Detector
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Salesperson only wrote down a monthly payment on a four-square sheet? Plug in 4 numbers right on your phone to expose hidden packed add-ons or a silently marked-up APR in 2 seconds.
            </p>

            <form onSubmit={runFourSquare} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Agreed / Sticker Price ($)" value={fsPrice} onChange={setFsPrice} />
              <NumField label="Down Payment / Trade Equity ($)" value={fsDown} onChange={setFsDown} />
              <NumField label="Sales Tax (%)" value={fsTax} step="0.1" onChange={setFsTax} />
              <NumField label="Est. Doc + DMV Fees ($)" value={fsFees} onChange={setFsFees} />
              <NumField label="Loan Term (Months)" value={fsTerm} onChange={setFsTerm} />
              <NumField label="Dealer's Monthly Quote ($/mo)" value={fsQuotedMonthly} onChange={setFsQuotedMonthly} />
              <NumField label="Fair Prime APR (%)" value={fsFairApr} step="0.1" onChange={setFsFairApr} />
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400"
                >
                  Expose Hidden Math
                </button>
              </div>
            </form>

            {fsResult && (
              <div
                className={`mt-4 rounded-xl border p-4 ${
                  fsResult.verdict === 'HEAVY_PACKING'
                    ? 'border-rose-500/50 bg-rose-500/10'
                    : fsResult.verdict === 'SUSPICIOUS_MARKUP'
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-emerald-500/50 bg-emerald-500/10'
                }`}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Your Clean Payment" value={`$${fsResult.fairMonthlyUsd}/mo`} accent="text-emerald-400" />
                  <MiniStat
                    label="Hidden Markup Packed In"
                    value={`$${fsResult.hiddenMarkupEstimateUsd.toLocaleString()}`}
                    accent={fsResult.hiddenMarkupEstimateUsd > 750 ? 'text-rose-400' : 'text-emerald-400'}
                  />
                  <MiniStat
                    label="OR Effective Implied APR"
                    value={fsResult.impliedAprAtFairPricePct !== null ? `${fsResult.impliedAprAtFairPricePct}%` : 'N/A'}
                    accent="text-amber-300"
                  />
                  <MiniStat
                    label={`Extra Cost Over ${fsTerm} mos`}
                    value={`$${Math.max(0, fsResult.totalPaymentGapUsd).toLocaleString()}`}
                    accent="text-rose-300"
                  />
                </div>
                <p className="mt-3 text-xs font-medium leading-relaxed text-slate-100">
                  {fsResult.explanation}
                </p>
              </div>
            )}
          </section>

          {/* 2B: Live Tap-to-Use Dealer Rebuttal Playbook */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <MessageSquareQuote className="h-3.5 w-3.5" /> Calm Word-for-Word Desk Responses
            </span>
            <h2 className="mt-1 text-xl font-bold text-white">
              What to Say When the Salesperson or F&I Manager Pushes Back
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {DEALER_REBUTTALS.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="text-xs font-semibold text-amber-300">{r.pitch}</div>
                  <div className="mt-1 inline-block rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                    Reality: {r.truth}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-200">{r.script}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 2C: Have an Email Quote or Worksheet Photo? Audit It Here */}
          <AuditWorkspace vertical="auto" initialAudit={initialAudit} />
        </div>
      )}

      {/* ================================================================= */}
      {/* STAGE 3: ALREADY BOUGHT? (CANCEL ADD-ONS & BREAK DOWN CONTRACT)   */}
      {/* ================================================================= */}
      {stage === 'after' && (
        <div className="space-y-8">
          {/* 3A: F&I Add-On Cancellation & Refund Calculator + Paywalled Self-Service Kit */}
          <section className="rounded-2xl border border-emerald-500/40 bg-slate-900/85 p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-3 w-3" /> Post-Purchase Recovery Engine (Self-Service)
                </span>
                <h2 className="mt-2 text-xl font-bold text-white">
                  Bought Extended Warranty, GAP, or Add-Ons? Calculate Your Refund & Loan Interest Saved
                </h2>
                <p className="mt-1 max-w-3xl text-xs text-slate-400">
                  Most buyers don't realize VSCs, GAP waivers, tire/wheel, and maintenance plans are <strong>legally cancellable</strong> (100% full refund in the free-look period, or prorated after). Even better: applying the refund to loan principal eliminates years of compound interest.
                </p>
              </div>
            </div>

            <form onSubmit={runRefundEstimate} className="mt-5 space-y-5">
              {/* Row 1: Purchase & Loan Details */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Purchase Date
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  State Purchased
                  <select
                    value={refundState}
                    onChange={(e) => setRefundState(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {(refData?.states || []).map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <NumField label="Loan APR (%)" value={loanApr} step="0.05" onChange={setLoanApr} />
                <NumField label="Loan Term (mos)" value={loanTerm} onChange={setLoanTerm} />
                <NumField label="Miles at Purchase" value={purchaseMileage} onChange={setPurchaseMileage} />
                <NumField label="Current Odometer" value={currentMileage} onChange={setCurrentMileage} />
              </div>

              {/* Row 2: Select Add-Ons Paid */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Check the Optional Add-Ons on Your Contract & Enter Price Paid:
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                  <AddonToggle label="Extended Warranty (VSC)" checked={vscOn} onToggle={setVscOn} amount={vscCost} onAmount={setVscCost} />
                  <AddonToggle label="GAP Waiver / Insurance" checked={gapOn} onToggle={setGapOn} amount={gapCost} onAmount={setGapCost} />
                  <AddonToggle label="Tire / Wheel / Key" checked={tireOn} onToggle={setTireOn} amount={tireCost} onAmount={setTireCost} />
                  <AddonToggle label="Prepaid Maintenance" checked={maintOn} onToggle={setMaintOn} amount={maintCost} onAmount={setMaintCost} />
                  <AddonToggle label="Paint / Fabric Shield" checked={paintOn} onToggle={setPaintOn} amount={paintCost} onAmount={setPaintCost} />
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-300">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={financedInLoan}
                      onChange={(e) => setFinancedInLoan(e.target.checked)}
                      className="rounded border-slate-600 accent-emerald-500"
                    />
                    Rolled into auto loan (refund reduces principal + cuts future interest)
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={claimsFiled}
                      onChange={(e) => setClaimsFiled(e.target.checked)}
                      className="rounded border-slate-600 accent-amber-500"
                    />
                    I have already filed a paid claim on these plans
                  </label>
                </div>
              </div>

              {/* Optional Pre-Fill Fields for Ready-to-Sign Letters */}
              <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <summary className="cursor-pointer text-xs font-semibold text-sky-300">
                  Optional: Pre-fill Your Name, VIN, Dealer, Administrator & Lender for Ready-to-Sign Letters
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextField label="Your Full Name" value={buyerName} onChange={setBuyerName} placeholder="Jane Doe" />
                  <TextField label="Dealership Name" value={dealerName} onChange={setDealerName} placeholder="Suncrest Motors" />
                  <TextField label="Plan Administrator" value={adminName} onChange={setAdminName} placeholder="Fidelity / Ally / Zurich / TFS" />
                  <TextField label="Auto Lender / Lienholder" value={lenderName} onChange={setLenderName} placeholder="Chase Auto / Capital One" />
                  <TextField label="Vehicle (Year Make Model)" value={vehicleYmm} onChange={setVehicleYmm} placeholder="2025 Honda CR-V Hybrid" />
                  <TextField label="VIN & Contract #" value={vin} onChange={setVin} placeholder="17-digit VIN" />
                </div>
                <div className="mt-2">
                  <TextField label="VSC / GAP Contract Number(s)" value={contractNumber} onChange={setContractNumber} placeholder="Optional contract or policy #" />
                </div>
              </details>

              <button
                type="submit"
                disabled={refundLoading}
                className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {refundLoading
                  ? 'Calculating Exact Proration & Interest Saved...'
                  : 'Calculate My Refund & Build Self-Service Cancellation Kit (Free Estimate)'}
              </button>
            </form>

            {/* Refund Result & Server-Enforced Paywall for Formal Templates */}
            {refundEstimate && refundKit && (
              <div className="mt-6 space-y-5 border-t border-slate-800 pt-6">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 sm:grid-cols-4">
                  <MiniStat
                    label={refundEstimate.withinFreeLook ? 'Free-Look Status (100%)' : 'Proration Status'}
                    value={refundEstimate.withinFreeLook ? `${refundEstimate.daysSincePurchase}d / ${refundEstimate.stateFreeLookDays}d Window` : `${refundEstimate.monthsElapsed} mos elapsed`}
                    accent="text-sky-300"
                  />
                  <MiniStat
                    label="Est. Principal / Cash Refund"
                    value={`$${refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()}`}
                    accent="text-white"
                  />
                  <MiniStat
                    label="Future Loan Interest Saved"
                    value={`+$${refundEstimate.estimatedLoanInterestSavedUsd.toLocaleString()}`}
                    accent="text-amber-300"
                  />
                  <MiniStat
                    label="Total Recoverable Value"
                    value={`$${refundEstimate.totalRecoverableValueUsd.toLocaleString()}`}
                    accent="text-emerald-400"
                  />
                </div>

                {/* Line-by-line proration breakdown */}
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                  {refundEstimate.lines.map((l: any, i: number) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>{l.label}</span>
                        <span className="font-mono text-emerald-400">~${l.estimatedRefundUsd.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Paid ${l.originalCostUsd.toLocaleString()} • {l.note}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paywalled Self-Service Cancellation Packet */}
                {!refundKit.isUnlocked ? (
                  <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                          <Lock className="h-3.5 w-3.5" />
                          Self-Service Cancellation Packet Ready ({roiMultiplier}× Estimated ROI)
                        </div>
                        <h3 className="text-lg font-bold text-white">
                          Unlock Your Ready-to-Sign Cancellation Demand Letter, Stall-Buster Escalation & PDF Packet
                        </h3>
                        <ul className="space-y-1 text-xs text-slate-300">
                          <li>• Pre-filled Formal Cancellation Notice (send directly to Plan Administrator + CC Dealer F&I + Lender)</li>
                          <li>• Day-14 "Dealer Stall-Buster" Escalation Letter (citing CFPB, State Insurance Dept. & State AG)</li>
                          <li>• Lender Principal-Application Verification Script + Step-by-Step Self-Service Checklist + Branded PDF</li>
                        </ul>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          disabled={unlockLoading}
                          onClick={() => handleUnlockKit('pass')}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
                        >
                          <CreditCard className="h-4 w-4" />
                          {refundKit.stripeLiveConfigured
                            ? `Unlock Packet ($${refundKit.pricing.passPriceUsd}) — Recover ~$${refundKit.estimatedSavingsUsd.toLocaleString()}`
                            : `Demo Unlock Packet ($${refundKit.pricing.passPriceUsd} Preview)`}
                        </button>
                        <span className="text-center text-[11px] text-slate-400">
                          100% self-service templates — you review, sign & send directly.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-emerald-500/40 bg-slate-950/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                        <Unlock className="h-3.5 w-3.5" /> Self-Service Cancellation Packet Unlocked
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!refundKit.counterOfferScript) return;
                            await navigator.clipboard.writeText(
                              `Subject: ${refundKit.counterOfferSubject}\n\n${refundKit.counterOfferScript}`
                            );
                            setCopiedLetter(true);
                            setTimeout(() => setCopiedLetter(false), 2200);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          {copiedLetter ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedLetter ? 'Copied!' : 'Copy Cancellation Letter'}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadAuditPdf(refundKit)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Branded PDF Packet
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        1. Formal Written Cancellation Request (Print/Sign/Email to Administrator & Dealer F&I)
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">
                        Subject: {refundKit.counterOfferSubject}
                      </div>
                      <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 font-sans text-xs leading-relaxed text-slate-200">
                        {refundKit.counterOfferScript}
                      </pre>
                    </div>

                    {refundKit.lockedFlags.map((f, idx) => (
                      <details key={idx} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                        <summary className="cursor-pointer text-xs font-bold text-amber-300">
                          {idx + 2}. {f.title} (Click to Expand)
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-300">
                          {f.detail}
                        </pre>
                      </details>
                    ))}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                        Step-by-Step Self-Service Action Checklist
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {refundKit.negotiationChecklist.map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3B: Signed Contract (TILA) Line-by-Line Breakdown Auditor */}
          <AuditWorkspace
            vertical="auto"
            sampleVariant="signed-contract"
            customBadge="Retail Installment Contract (TILA) Breakdown"
            customTitle="Already Signed? Upload or Paste Your Loan Contract to Decode Every Box & Rolled-In Add-On"
            customSampleLabel="Try Sample Signed TILA Contract ($43,620)"
            initialAudit={
              initialAudit && !initialAudit.auditId.startsWith('vp_autorefund_') ? initialAudit : null
            }
          />

          {/* 3C: Direct-to-Administrator Bypass Directory */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
                  <Building2 className="h-3.5 w-3.5" /> Bypass Stalling F&I Desks
                </span>
                <h2 className="mt-1 text-lg font-bold text-white">
                  Major F&I Plan Administrator Direct-Cancellation Directory
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Look on the top corner of your warranty or GAP contract page to find the administrator name below.
                </p>
              </div>
              <input
                type="text"
                value={adminQuery}
                onChange={(e) => setAdminQuery(e.target.value)}
                placeholder="Search Ally, Fidelity, Zurich, Toyota..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 sm:w-64"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredAdmins.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-950/75 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{a.name}</h3>
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                      {a.freeLookWindow}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{a.products}</div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{a.directBypassTip}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {a.requiredDocs.map((d, i) => (
                      <span key={i} className="rounded bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 border-t border-slate-800 pt-2 font-mono text-[11px] text-sky-300">
                    {a.contactHint}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3D: Official Government & Consumer Protection Resources */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Gavel className="h-3.5 w-3.5" /> Official Escalation Resources (Free Public Agencies)
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">
              Where to File If a Dealer Illegally Refuses or Stalls Your Refund
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(refData?.resources || []).map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-amber-500/40"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-amber-300">{r.name}</h3>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-amber-300" />
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-sky-400">{r.role}</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{r.whenToUse}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const StageTab: React.FC<{
  active: boolean;
  step: string;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}> = ({ active, step, title, desc, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border p-4 text-left transition ${
      active
        ? 'border-sky-400 bg-sky-500/15 shadow-lg shadow-sky-500/10'
        : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${active ? 'text-sky-300' : 'text-slate-400'}`}>
        {step}
      </span>
      {badge && (
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          {badge}
        </span>
      )}
    </div>
    <div className="mt-1.5 text-base font-bold text-white">{title}</div>
    <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
  </button>
);

const MiniStat: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent = 'text-white',
}) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-bold ${accent}`}>{value}</div>
  </div>
);

const NumField: React.FC<{
  label: string;
  value: number;
  step?: string;
  onChange: (v: number) => void;
}> = ({ label, value, step = '1', onChange }) => (
  <label className="flex flex-col gap-1 text-xs text-slate-400">
    {label}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
    />
  </label>
);

const TextField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <label className="flex flex-col gap-1 text-xs text-slate-400">
    {label}
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
    />
  </label>
);

const AddonToggle: React.FC<{
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  amount: number;
  onAmount: (v: number) => void;
}> = ({ label, checked, onToggle, amount, onAmount }) => (
  <div
    className={`rounded-xl border p-3 transition ${
      checked ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'
    }`}
  >
    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-emerald-500"
      />
      <span>{label}</span>
    </label>
    <div className="mt-2 flex items-center gap-1">
      <span className="text-xs text-slate-500">$</span>
      <input
        type="number"
        disabled={!checked}
        value={amount}
        onChange={(e) => onAmount(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white disabled:opacity-40"
      />
    </div>
  </div>
);
