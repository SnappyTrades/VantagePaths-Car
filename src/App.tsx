import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Car,
  CheckCircle2,
  Compass,
  DollarSign,
  LifeBuoy,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { PublicAuditResponse } from './shared/types';
import { BuyFromHomePage } from './components/BuyFromHomePage';
import { LoanRescuePage } from './components/LoanRescuePage';
import { InsuranceAuditPage, SellOrTradePage, StatesLawHubPage } from './components/InsuranceSellPages';
import { AdminFunnelView } from './components/AdminFunnelView';
import { PartnerCard } from './components/PartnerCard';

function parseRoute(pathname: string): { view: string; stateCode: string | null } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean.startsWith('/state/')) {
    const code = clean.slice('/state/'.length).toUpperCase().slice(0, 2);
    return { view: 'states', stateCode: code || null };
  }
  if (clean === '/buy' || clean === '/auto') return { view: 'buy', stateCode: null };
  if (clean === '/rescue') return { view: 'rescue', stateCode: null };
  if (clean === '/insurance') return { view: 'insurance', stateCode: null };
  if (clean === '/sell') return { view: 'sell', stateCode: null };
  if (clean === '/states') return { view: 'states', stateCode: null };
  if (clean === '/admin') return { view: 'admin', stateCode: null };
  return { view: 'home', stateCode: null };
}

export function App() {
  const [loc, setLoc] = useState(() => parseRoute(window.location.pathname));
  const [refData, setRefData] = useState<any>(null);
  const [verifiedAudit, setVerifiedAudit] = useState<PublicAuditResponse | null>(null);
  const [verifyBanner, setVerifyBanner] = useState<string | null>(null);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setLoc(parseRoute(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => setLoc(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    fetch('/api/auto/reference')
      .then((r) => r.json())
      .then(setRefData)
      .catch(() => {});
  }, []);

  // Auto-verify Stripe return (?unlocked=1&session_id=...&audit_id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlocked = params.get('unlocked');
    const sessionId = params.get('session_id');
    const auditId = params.get('audit_id');
    if (unlocked === '1' && sessionId && auditId) {
      fetch(
        `/api/billing/verify?session_id=${encodeURIComponent(sessionId)}&audit_id=${encodeURIComponent(auditId)}`
      )
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Verification failed');
          setVerifiedAudit(data as PublicAuditResponse);
          setVerifyBanner('Payment verified — your full 60-Day VantagePaths Auto Pass & PDFs are unlocked!');
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((err) => setVerifyBanner(`Stripe verification notice: ${err.message}`));
    }
  }, []);

  const states = refData?.states || [];

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#0B1528]">
      {/* Editorial Light Top Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-[#FAF9F5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B1528] to-[#0F766E] text-white shadow-sm">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight text-[#0B1528]">
                Vantage<span className="text-[#0F766E]">Paths</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Car Ownership Without the Hassle
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink active={loc.view === 'home'} onClick={() => navigate('/')}>Overview</NavLink>
            <NavLink active={loc.view === 'buy'} onClick={() => navigate('/buy')}>1. Buy From Home</NavLink>
            <NavLink active={loc.view === 'rescue'} onClick={() => navigate('/rescue')}>2. Loan Rescue</NavLink>
            <NavLink active={loc.view === 'insurance'} onClick={() => navigate('/insurance')}>3. Insurance</NavLink>
            <NavLink active={loc.view === 'sell'} onClick={() => navigate('/sell')}>4. Sell / Trade</NavLink>
            <NavLink active={loc.view === 'states'} onClick={() => navigate('/states')}>50 States</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin')}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                loc.view === 'admin'
                  ? 'border-[#0F766E] bg-teal-50 text-[#0F766E]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Revenue
            </button>
            <button
              onClick={() => navigate('/rescue')}
              className="hidden rounded-xl bg-[#0B1528] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0F766E] sm:inline-flex"
            >
              Check Refund Free →
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-200/70 px-4 py-2 md:hidden">
          {[
            ['/', 'Home'],
            ['/buy', 'Buy'],
            ['/rescue', 'Loan Rescue'],
            ['/insurance', 'Insurance'],
            ['/sell', 'Sell/Trade'],
            ['/states', '50 States'],
          ].map(([p, lbl]) => (
            <button
              key={p}
              onClick={() => navigate(p)}
              className="whitespace-nowrap rounded-lg bg-white px-3 py-1 text-xs font-bold text-[#0B1528] border border-slate-200"
            >
              {lbl}
            </button>
          ))}
        </div>
      </header>

      {verifyBanner && (
        <div className="border-b border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-xs font-bold text-[#0F766E]">
          {verifyBanner}
        </div>
      )}

      {/* Views */}
      {loc.view === 'home' && <EditorialHomePage navigate={navigate} states={states} />}
      {loc.view === 'buy' && <BuyFromHomePage states={states} initialAudit={verifiedAudit} />}
      {loc.view === 'rescue' && <LoanRescuePage refData={refData} initialAudit={verifiedAudit} />}
      {loc.view === 'insurance' && <InsuranceAuditPage states={states} />}
      {loc.view === 'sell' && <SellOrTradePage states={states} />}
      {loc.view === 'states' && (
        <StatesLawHubPage states={states} selectedCode={loc.stateCode} navigate={navigate} />
      )}
      {loc.view === 'admin' && <AdminFunnelView />}

      {/* Authoritative Editorial Footer + FTC Disclosure */}
      <footer className="mt-16 border-t border-slate-200 bg-[#0B1528] py-12 text-slate-300">
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="text-lg font-extrabold text-white">
                Vantage<span className="text-teal-400">Paths</span>.com
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                100% Independent Self-Service Car Ownership Platform — Buy From Home, Cancel Overpriced F&amp;I Add-Ons, Slash Auto Insurance Without Spam, and Exit for Max Cash.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <button onClick={() => navigate('/buy')} className="hover:text-teal-300">Buy From Home</button>
              <button onClick={() => navigate('/rescue')} className="hover:text-teal-300">2-Step Loan Rescue</button>
              <button onClick={() => navigate('/insurance')} className="hover:text-teal-300">Insurance Audit</button>
              <button onClick={() => navigate('/sell')} className="hover:text-teal-300">Sell / Trade</button>
              <button onClick={() => navigate('/states')} className="hover:text-teal-300">50-State Laws</button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 text-[11px] leading-relaxed text-slate-400">
            <strong>Self-Service &amp; Affiliate Transparency:</strong> VantagePaths provides independent calculators, official NHTSA lookups, 50-state statutory references, and user-sent templates. You review, sign, and submit all documents yourself — VantagePaths does not act as your legal representative, broker, or licensed insurance agent. To keep core calculators 100% free, VantagePaths earns revenue both from optional $29 Self-Service Passes and from disclosed partner referrals (auto refinance, pre-approval, auto insurance, cash offers, and mobile inspections) at $0 extra cost to you.
          </div>
        </div>
      </footer>
    </div>
  );
}

const NavLink: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
      active ? 'bg-teal-50 text-[#0F766E]' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0B1528]'
    }`}
  >
    {children}
  </button>
);

const EditorialHomePage: React.FC<{ navigate: (path: string) => void; states: any[] }> = ({
  navigate,
  states,
}) => {
  // Interactive Hero Dual Widget (Loan Rescue Quick Check + Live VIN Quick Check)
  const [heroTab, setHeroTab] = useState<'rescue' | 'vin'>('rescue');
  const [chkVsc, setChkVsc] = useState(true);
  const [chkGap, setChkGap] = useState(true);
  const [chkTire, setChkTire] = useState(true);
  const [quickVin, setQuickVin] = useState('2T3P1RFV0RW441234');
  const [quickVinRes, setQuickVinRes] = useState<any>(null);
  const [quickVinLoading, setQuickVinLoading] = useState(false);

  const principalRefund = (chkVsc ? 3495 : 0) + (chkGap ? 1195 : 0) + (chkTire ? 895 : 0);
  const interestSaved = Math.round(principalRefund * 0.285);
  const totalRecover = principalRefund + interestSaved;

  const runQuickVin = async () => {
    setQuickVinLoading(true);
    try {
      const r = await fetch(`/api/auto/vin/${encodeURIComponent(quickVin.trim())}`);
      if (r.ok) setQuickVinRes(await r.json());
    } finally {
      setQuickVinLoading(false);
    }
  };

  return (
    <main>
      {/* SPLIT EDITORIAL HERO */}
      <section className="border-b border-slate-200/80 py-14 sm:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-xs font-bold text-[#0F766E]">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Independent • 50-State Coverage • Zero Dealer Kickbacks
            </span>
            <h1 className="font-serif-display text-4xl font-bold leading-[1.08] tracking-tight text-[#0B1528] sm:text-5xl">
              Do everything you <em className="text-[#0F766E]">hate</em> about owning a car — smarter, from your couch.
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Skip 4-hour dealership traps and insurance spam calls. VantagePaths gives you the exact tools to <strong>buy a car 95% online</strong>, <strong>cancel $2k–$5k in regretted warranties &amp; GAP</strong> to unlock refinancing, <strong>audit your insurance every 6 months</strong>, and <strong>sell for max cash</strong>.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => navigate('/buy')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-teal-900/15 transition hover:bg-[#115E59]"
              >
                Buy a Car From Home <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/rescue')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-extrabold text-[#0B1528] transition hover:border-[#0B1528]"
              >
                Already Bought? Cancel Add-Ons
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" /> Live US Gov NHTSA VIN Recalls</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" /> All 50 States + DC Fee Caps</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" /> Self-Service Letters &amp; PDFs</span>
            </div>
          </div>

          {/* INTERACTIVE HERO WIDGET */}
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5">
                <button
                  onClick={() => setHeroTab('rescue')}
                  className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                    heroTab === 'rescue' ? 'bg-white text-[#0B1528] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  2-Step Loan Rescue Check
                </button>
                <button
                  onClick={() => setHeroTab('vin')}
                  className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                    heroTab === 'vin' ? 'bg-white text-[#0B1528] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Free Live NHTSA VIN Check
                </button>
              </div>

              {heroTab === 'rescue' ? (
                <div className="space-y-3 p-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Toggle Optional Dealer Add-Ons (Sample: Financed @ 8.89% APR)
                  </div>
                  {[
                    ['Extended Warranty (VSC)', '$3,495', '100% Optional • Cancellable for refund', chkVsc, setChkVsc],
                    ['Dealer GAP Waiver', '$1,195', 'Replace with ~$250 insurer GAP', chkGap, setChkGap],
                    ['Tire, Wheel & Key Bundle', '$895', 'High-commission F&I bundle', chkTire, setChkTire],
                  ].map(([lbl, price, sub, val, setter]: any, idx) => (
                    <label
                      key={idx}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                        val ? 'border-[#0F766E] bg-teal-50/60' : 'border-slate-200 bg-[#FAF9F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => setter(e.target.checked)}
                          className="accent-[#0F766E]"
                        />
                        <div>
                          <div className="text-xs font-extrabold text-[#0B1528]">{lbl}</div>
                          <div className="text-[11px] text-slate-500">{sub}</div>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#0B1528]">{price}</span>
                    </label>
                  ))}

                  <div className="rounded-xl bg-[#0B1528] p-4 text-white">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-teal-300">
                          Est. Add-On Refund + Interest Killed
                        </div>
                        <div className="text-[11px] text-slate-400">Also drops Loan-to-Value so you can refinance!</div>
                      </div>
                      <div className="font-mono text-3xl font-extrabold text-emerald-300">
                        ${totalRecover.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/rescue')}
                      className="mt-3 w-full rounded-lg bg-teal-400 py-2.5 text-xs font-extrabold text-[#042F2E] hover:bg-teal-300"
                    >
                      Open Full 2-Step Loan Rescue &amp; Cancellation Kit →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Official US Gov NHTSA Decoder (Free Instant Recall &amp; Complaint Check)
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={17}
                      value={quickVin}
                      onChange={(e) => setQuickVin(e.target.value.toUpperCase())}
                      className="flex-1 rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 font-mono text-xs text-[#0B1528]"
                    />
                    <button
                      type="button"
                      disabled={quickVinLoading}
                      onClick={runQuickVin}
                      className="rounded-xl bg-[#0B1528] px-4 py-2 text-xs font-bold text-white hover:bg-[#0F766E]"
                    >
                      {quickVinLoading ? '...' : 'Decode'}
                    </button>
                  </div>
                  {quickVinRes ? (
                    <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-xs">
                      <div className="font-extrabold text-[#0B1528]">
                        {quickVinRes.year} {quickVinRes.make} {quickVinRes.model} ({quickVinRes.trim})
                      </div>
                      <div className="font-mono text-[11px] text-[#0F766E]">
                        {quickVinRes.recallCount} Recall(s) • {quickVinRes.complaintCount} NHTSA Complaints
                      </div>
                      <p className="text-slate-700">{quickVinRes.negotiationInsight}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Click Decode on the sample RAV4 Hybrid VIN above (or paste any 17-digit VIN) to pull live federal recalls and defect hotspots.
                    </p>
                  )}
                  <button
                    onClick={() => navigate('/buy')}
                    className="w-full rounded-xl bg-[#0F766E] py-2.5 text-xs font-extrabold text-white hover:bg-[#115E59]"
                  >
                    Launch Full Buy-From-Home Deal Room →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* THE 4 PILLARS DIRECTORY */}
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-14 sm:px-6">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E]">
            The 4-Pillar Advantage Platform
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-bold text-[#0B1528]">
            Every Hated Car-Ownership Chore — Solved From Home
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <PillarCard
            icon={<Car className="h-5 w-5 text-[#0F766E]" />}
            kicker="PILLAR 1 • BUY FROM HOME"
            title="Couch-to-Keys Remote Deal Room"
            desc="Live NHTSA VIN recalls, 5-dealer blind email bid-war scripts, side-by-side quote comparison board, out-of-state shipping math, 4-square BS-detector, and pre-delivery contract PDF audits."
            cta="Open Buy-From-Home Room"
            onClick={() => navigate('/buy')}
          />
          <PillarCard
            icon={<LifeBuoy className="h-5 w-5 text-[#0F766E]" />}
            kicker="PILLAR 2 • HIGHEST ROI"
            title="2-Step Car Loan Rescue & Add-On Refunds"
            desc="Cancel overpriced Extended Warranties, GAP & F&I bundles to slash loan principal & LTV, unlock credit union auto refinancing, and generate ready-to-sign Cancellation + Day-14 Stall-Buster PDFs."
            cta="Run 2-Step Loan Rescue"
            highlight
            onClick={() => navigate('/rescue')}
          />
          <PillarCard
            icon={<Shield className="h-5 w-5 text-[#0F766E]" />}
            kicker="PILLAR 3 • EVERY 6 MONTHS"
            title="Zero-Spam Auto Insurance Audit"
            desc="Audit your Declarations Page for renewal loyalty penalties, deductible break-even math, and roadside CLUE traps — then export a 1-page Apples-to-Apples Quote Spec Sheet + set 6-month alerts."
            cta="Audit My Insurance Policy"
            onClick={() => navigate('/insurance')}
          />
          <PillarCard
            icon={<Tag className="h-5 w-5 text-[#0F766E]" />}
            kicker="PILLAR 4 • MAX-CASH EXIT"
            title="Sell or Trade In Without Getting Lowballed"
            desc="Compare dealer trade-in (+ exact state sales tax credit!) vs. online instant cash offers vs. private party sale, backed by a zero-scam bank-verified payment & DMV checklist."
            cta="Optimize My Exit Path"
            onClick={() => navigate('/sell')}
          />
        </div>
      </section>

      {/* TRANSPARENT DUAL-REVENUE SECTION (DAY-1 EARNINGS WHETHER USERS BUY OR NOT) */}
      <section className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
          <div className="max-w-3xl">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E]">
              Simple Pricing &amp; Transparent Revenue Model
            </span>
            <h2 className="font-serif-display mt-1 text-3xl font-bold text-[#0B1528]">
              Free Tools Forever. Pay $29 Only When You Want Ready-to-Send Packets.
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Whether a visitor uses our free calculators and compares an auto refi / insurance offer, OR unlocks the full 60-Day Self-Service Pass, VantagePaths stays 100% independent of dealership markups.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <PriceTier
              badge="FREE FOREVER"
              title="Calculators, VIN & 50-State Laws"
              price="$0"
              unit="no card required"
              items={[
                'Live US Gov NHTSA VIN Recalls & Complaints',
                'All 50 States + DC Doc Caps & Tax Credits',
                '4-Square BS-Detector & 2-Step LTV Simulator',
                'Free Red-Flag Preview on Any Contract PDF',
              ]}
              cta="Start Free in Deal Room"
              onClick={() => navigate('/buy')}
            />
            <PriceTier
              badge="MOST POPULAR • ALL 4 PILLARS"
              title="60-Day VantagePaths Auto Pass"
              price="$29"
              unit="one-time payment"
              featured
              items={[
                'Unlimited OTD, TILA & Insurance PDF Audits',
                'Pre-Filled F&I Cancellation Demand Letter PDF',
                'Day-14 Dealer Stall-Buster Escalation Letter',
                'Round 1 & Round 2 Multi-Dealer Bid-War Kit',
              ]}
              cta="Unlock Via Loan Rescue or Audit"
              onClick={() => navigate('/rescue')}
            />
            <PriceTier
              badge="CONVENIENCE ADD-ON"
              title="1-Click USPS Certified Mail"
              price="+$15"
              unit="per letter packet"
              items={[
                'You Review & Sign Your Own Cancellation Notice',
                'Physical USPS Return-Receipt Proof to Admin + F&I',
                'Zero Post Office Trips or Awkward Calls',
                '100% Self-Service (Zero Legal Representation)',
              ]}
              cta="Preview Cancellation Mail Flow"
              onClick={() => navigate('/rescue')}
            />
          </div>

          {/* Built-in Partner Revenue Showcase */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PartnerCard
              partnerId="auto-refi-credit-union"
              badge="Auto Refinance Partner"
              title="Stuck Above 7.5% Dealer APR? Check Soft-Pull Credit Union Refi Rates"
              subtitle="Lowering a $36,000 loan by 3% saves ~$1,900+ in interest — zero impact to your credit score to check."
              ctaLabel="Compare Refi Rates"
              source="home_strip"
              accent="navy"
            />
            <PartnerCard
              partnerId="auto-insurance-compare"
              badge="Auto Insurance Partner"
              title="Paying Too Much at Renewal? Benchmark Apples-to-Apples Rates"
              subtitle="Compare carriers side-by-side and swap $1,200 dealership GAP for ~$5/mo insurer Loan/Lease Payoff coverage."
              ctaLabel="Compare Insurance Quotes"
              source="home_strip"
            />
          </div>
        </div>
      </section>

      {/* 50-STATE QUICK JUMP STRIP */}
      <section className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F766E]">
              Every State Plays by Different Rules
            </span>
            <h2 className="font-serif-display text-2xl font-bold text-[#0B1528]">
              Check Your State's Doc Fee Cap, Tax Credit &amp; Warranty Refund Law
            </h2>
          </div>
          <button
            onClick={() => navigate('/states')}
            className="text-xs font-extrabold text-[#0F766E] hover:underline"
          >
            View All {states.length || 51} States →
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['CA', 'TX', 'FL', 'NY', 'OH', 'GA', 'NC', 'VA', 'IL', 'PA', 'WA', 'AZ', 'CO', 'NJ', 'MI'].map((code) => (
            <button
              key={code}
              onClick={() => navigate(`/state/${code}`)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs font-bold text-[#0B1528] shadow-xs transition hover:border-[#0F766E] hover:text-[#0F766E]"
            >
              <MapPin className="h-3 w-3 text-[#0F766E]" /> {code}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

const PillarCard: React.FC<{
  icon: React.ReactNode;
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  highlight?: boolean;
  onClick: () => void;
}> = ({ icon, kicker, title, desc, cta, highlight = false, onClick }) => (
  <div
    className={`flex flex-col justify-between rounded-2xl border p-6 shadow-xs transition hover:shadow-md ${
      highlight ? 'border-[#0F766E] bg-teal-50/50' : 'border-slate-200 bg-white'
    }`}
  >
    <div>
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200 bg-teal-50">
          {icon}
        </div>
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#0F766E]">
          {kicker}
        </span>
      </div>
      <h3 className="font-serif-display mt-4 text-xl font-bold text-[#0B1528]">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{desc}</p>
    </div>
    <button
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0F766E] hover:underline"
    >
      {cta} <ArrowRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

const PriceTier: React.FC<{
  badge: string;
  title: string;
  price: string;
  unit: string;
  items: string[];
  cta: string;
  featured?: boolean;
  onClick: () => void;
}> = ({ badge, title, price, unit, items, cta, featured = false, onClick }) => (
  <div
    className={`flex flex-col justify-between rounded-2xl border p-6 ${
      featured
        ? 'border-[#0F766E] bg-gradient-to-b from-teal-50/70 to-white shadow-lg shadow-teal-900/10'
        : 'border-slate-200 bg-[#FAF9F5]'
    }`}
  >
    <div>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
          featured ? 'bg-[#0F766E] text-white' : 'bg-white text-slate-600 border border-slate-200'
        }`}
      >
        {badge}
      </span>
      <h3 className="mt-3 text-base font-extrabold text-[#0B1528]">{title}</h3>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-serif-display text-4xl font-bold text-[#0B1528]">{price}</span>
        <span className="text-xs font-semibold text-slate-500">{unit}</span>
      </div>
      <ul className="mt-4 space-y-2 text-xs font-medium text-slate-700">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
    <button
      onClick={onClick}
      className={`mt-6 w-full rounded-xl py-2.5 text-xs font-extrabold transition ${
        featured
          ? 'bg-[#0F766E] text-white hover:bg-[#115E59]'
          : 'border border-slate-300 bg-white text-[#0B1528] hover:border-[#0B1528]'
      }`}
    >
      {cta}
    </button>
  </div>
);

export default App;
