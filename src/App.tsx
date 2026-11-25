import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Car,
  CheckCircle2,
  Coins,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sofa,
  Sparkles,
  Tag,
  Home as HouseIcon,
  Wallet,
  MonitorSmartphone,
  ReceiptText,
  BookOpen,
  Zap,
} from 'lucide-react';
import { LifeVerticalPage, type LifeVerticalId } from './components/LifeVerticalPage';
import type { PublicAuditResponse } from './shared/types';
import { BuyFromHomePage } from './components/BuyFromHomePage';
import { LoanRescuePage } from './components/LoanRescuePage';
import { InsuranceAuditPage, SellOrTradePage, StatesLawHubPage } from './components/InsuranceSellPages';
import { AdminFunnelView } from './components/AdminFunnelView';
import { PartnerCard } from './components/PartnerCard';
import { VantagePathsLogo } from './components/VantagePathsLogo';

const LIFE_ROUTES: LifeVerticalId[] = ['home', 'money', 'tech', 'protect', 'life'];
const AUTO_VIEWS = new Set(['autoHome', 'buy', 'rescue', 'insurance', 'sell', 'states']);

/**
 * Brand-level routing:
 *   /                      → VantagePaths brand homepage (all 6 paths)
 *   /auto, /auto/*         → Auto flagship vertical (old /buy, /rescue... URLs still work)
 *   /home /money /tech /protect /life → Life verticals (live tools)
 */
function parseRoute(pathname: string): { view: string; stateCode: string | null } {
  let clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/auto') return { view: 'autoHome', stateCode: null };
  if (clean.startsWith('/auto/')) clean = clean.slice('/auto'.length);
  if (clean.startsWith('/state/')) {
    const code = clean.slice('/state/'.length).toUpperCase().slice(0, 2);
    return { view: 'states', stateCode: code || null };
  }
  if (clean === '/buy') return { view: 'buy', stateCode: null };
  if (clean === '/rescue') return { view: 'rescue', stateCode: null };
  if (clean === '/insurance') return { view: 'insurance', stateCode: null };
  if (clean === '/sell') return { view: 'sell', stateCode: null };
  if (clean === '/states') return { view: 'states', stateCode: null };
  if (clean === '/admin') return { view: 'admin', stateCode: null };
  const life = clean.slice(1) as LifeVerticalId;
  if (LIFE_ROUTES.includes(life)) return { view: life, stateCode: null };
  return { view: 'brand', stateCode: null };
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

  // Dynamic per-route & per-state SEO document titles
  useEffect(() => {
    const titles: Record<string, string> = {
      brand: 'VantagePaths — Smarter From Your Couch | Tools for Life\'s Frustrating Decisions',
      autoHome: 'VantagePaths Auto — Buy, Finance, Insure & Sell Your Car From Home',
      home: 'Internet & Cable Bill Negotiator — VantagePaths Home',
      money: 'Credit Card APR Reduction & Fee Reversal — VantagePaths Money',
      tech: 'Cell Phone Plan Right-Sizer — VantagePaths Tech',
      protect: 'Charge Dispute & Refund Letter Builder — VantagePaths Protect',
      life: 'Subscription Cancellation Center — VantagePaths Everyday Life',
      buy: 'Buy a Car From Home: Anti-Dealer Hunter & Bid-War Room — VantagePaths',
      rescue: '2-Step Car Loan Rescue & Extended Warranty / GAP Refund Kit — VantagePaths',
      insurance: 'Zero-Spam Auto Insurance Declarations Audit — VantagePaths',
      sell: 'Sell or Trade In Your Car for Max Cash (Tax Credit Math) — VantagePaths',
      states: 'State-by-State Dealer Doc Fee Caps & Car Buyer Laws — VantagePaths',
      admin: 'Live Revenue & Partner Attribution — VantagePaths',
    };
    if (loc.view === 'states' && loc.stateCode) {
      document.title = `${loc.stateCode} Dealer Doc Fee Cap, Tax Credit & Warranty Refund Laws — VantagePaths`;
    } else {
      document.title = titles[loc.view] || titles.brand;
    }
  }, [loc.view, loc.stateCode]);

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
    <div className="min-h-screen text-[#071930]">
      {/* Executive Midnight-Glass Sticky Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#041225]/92 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button onClick={() => navigate('/')} className="flex items-center text-left transition hover:opacity-95">
            <VantagePathsLogo theme="dark" size="md" />
          </button>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:flex">
            {BRAND_PATHS.map((p) => (
              <NavLink
                key={p.path}
                active={p.id === 'auto' ? AUTO_VIEWS.has(loc.view) : loc.view === p.id}
                onClick={() => navigate(p.path)}
              >
                {p.short}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/admin')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                loc.view === 'admin'
                  ? 'border-teal-400/50 bg-teal-500/20 text-teal-200'
                  : 'border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/12'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-teal-300" /> Revenue
            </button>
            <button
              onClick={() => navigate('/auto/rescue')}
              className="vp-btn-emerald hidden items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold text-white transition sm:inline-flex"
            >
              Start Saving <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Brand Path Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-[#06182E]/90 px-4 py-2 lg:hidden">
          {BRAND_PATHS.map((p) => {
            const active = p.id === 'auto' ? AUTO_VIEWS.has(loc.view) : loc.view === p.id;
            return (
              <button
                key={p.path}
                onClick={() => navigate(p.path)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  active
                    ? 'border border-teal-400/40 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 text-teal-200'
                    : 'border border-white/10 bg-white/5 text-slate-300'
                }`}
              >
                {p.short}
              </button>
            );
          })}
        </div>

        {/* Auto Sub-Navigation (only inside the Auto vertical) */}
        {AUTO_VIEWS.has(loc.view) && (
          <div className="border-t border-white/10 bg-[#071d38]/95">
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
              <span className="mr-2 hidden whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-teal-300 sm:inline">
                VantagePaths Auto
              </span>
              {[
                ['/auto', 'Overview', 'autoHome'],
                ['/auto/buy', '1. Buy From Home', 'buy'],
                ['/auto/rescue', '2. Loan Rescue', 'rescue'],
                ['/auto/insurance', '3. Insurance', 'insurance'],
                ['/auto/sell', '4. Sell / Trade', 'sell'],
                ['/auto/states', 'State Laws', 'states'],
              ].map(([p, lbl, key]) => (
                <button
                  key={p}
                  onClick={() => navigate(p)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                    loc.view === key ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {verifyBanner && (
        <div className="border-b border-emerald-400/30 bg-emerald-950 px-4 py-2.5 text-center text-xs font-bold text-emerald-200">
          {verifyBanner}
        </div>
      )}

      {/* Views */}
      {loc.view === 'brand' && <BrandHomePage navigate={navigate} />}
      {loc.view === 'autoHome' && <ShowcaseHomePage navigate={navigate} />}
      {LIFE_ROUTES.includes(loc.view as LifeVerticalId) && (
        <LifeVerticalPage key={loc.view} vertical={loc.view as LifeVerticalId} navigate={navigate} />
      )}
      {loc.view === 'buy' && <BuyFromHomePage states={states} initialAudit={verifiedAudit} />}
      {loc.view === 'rescue' && <LoanRescuePage refData={refData} initialAudit={verifiedAudit} />}
      {loc.view === 'insurance' && <InsuranceAuditPage states={states} />}
      {loc.view === 'sell' && <SellOrTradePage states={states} />}
      {loc.view === 'states' && (
        <StatesLawHubPage states={states} selectedCode={loc.stateCode} navigate={navigate} />
      )}
      {loc.view === 'admin' && <AdminFunnelView />}

      {/* Executive Midnight Footer + FTC Disclosure */}
      <footer className="mt-20 border-t border-white/10 bg-[#041225] py-14 text-slate-300">
        <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <VantagePathsLogo theme="dark" size="md" />
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">
                Life is complicated enough. Getting things done shouldn't be. Smart tools for life's frustrating decisions — save money, save time, and take control without leaving home.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {BRAND_PATHS.map((p) => [p.path, p.label]).map(([path, label]) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 text-[11px] leading-relaxed text-slate-400">
            <strong className="text-slate-200">Self-Service &amp; Affiliate Transparency:</strong> VantagePaths provides independent calculators, official NHTSA lookups, 50-state statutory references, and user-sent templates. You review, sign, and submit all documents yourself — VantagePaths does not act as your legal representative, broker, or licensed insurance agent. To keep core calculators 100% free, VantagePaths earns revenue both from optional $14–$29 Self-Service Packets and from disclosed partner referrals (auto refinance, pre-approval, auto insurance, cash offers, and mobile inspections) at $0 extra cost to you.
          </div>
        </div>
      </footer>
    </div>
  );
}

const BRAND_PATHS: Array<{
  id: string;
  path: string;
  short: string;
  label: string;
  icon: React.ReactNode;
  desc: string;
  liveTool: string;
  status: string;
}> = [
  {
    id: 'auto',
    path: '/auto',
    short: 'Auto',
    label: 'Auto',
    icon: <Car className="h-5 w-5" />,
    desc: 'Buy, finance, insure and sell your vehicle.',
    liveTool: 'Warranty & GAP refunds, dealer bid-wars, VIN checks, insurance audit',
    status: 'Flagship • 12+ tools',
  },
  {
    id: 'home',
    path: '/home',
    short: 'Home',
    label: 'Home',
    icon: <HouseIcon className="h-5 w-5" />,
    desc: 'Compare utilities, internet and household services.',
    liveTool: 'Internet & Cable Bill Negotiator',
    status: 'Live',
  },
  {
    id: 'money',
    path: '/money',
    short: 'Money',
    label: 'Money',
    icon: <Wallet className="h-5 w-5" />,
    desc: 'Reduce expenses, negotiate bills and compare financial products.',
    liveTool: 'Credit Card APR Reduction & Fee Reversal',
    status: 'Live',
  },
  {
    id: 'tech',
    path: '/tech',
    short: 'Tech',
    label: 'Technology',
    icon: <MonitorSmartphone className="h-5 w-5" />,
    desc: 'Simplify devices, software and everyday digital problems.',
    liveTool: 'Cell Phone Plan Right-Sizer',
    status: 'Live',
  },
  {
    id: 'protect',
    path: '/protect',
    short: 'Protect',
    label: 'Consumer Protection',
    icon: <ShieldCheck className="h-5 w-5" />,
    desc: 'Understand contracts, refunds, warranties and disputes.',
    liveTool: 'Charge Dispute & Refund Builder',
    status: 'Live',
  },
  {
    id: 'life',
    path: '/life',
    short: 'Everyday Life',
    label: 'Everyday Life',
    icon: <ReceiptText className="h-5 w-5" />,
    desc: 'Cancel subscriptions, handle paperwork and eliminate unnecessary expenses.',
    liveTool: 'Subscription Cancellation Center',
    status: 'Live',
  },
];

/* =====================================================================
   VANTAGEPATHS BRAND HOMEPAGE — "Smarter from your couch."
===================================================================== */
const BrandHomePage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const compare: Array<[string, string, string]> = [
    ['Read about negotiating a car', 'Generate a dealer bid-war email', '/auto/buy'],
    ['Learn about refinancing', 'Calculate your exact refinance savings', '/auto/rescue'],
    ['Research insurance', 'Generate a standardized quote request', '/auto/insurance'],
    ['Learn about cancelling warranties', 'Generate a state-specific cancellation letter', '/auto/rescue'],
    ['Read about lowering internet bills', 'Build a retention script for your exact bill', '/home'],
    ['Research consumer rights', 'Get your dispute deadline + ready-to-send letters', '/protect'],
  ];

  return (
    <main>
      {/* HERO */}
      <section className="vp-hero-canvas relative overflow-hidden pb-32 pt-14 text-white sm:pb-36 sm:pt-20">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 1440 560"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M-60 470 C 380 300, 840 520, 1520 190" stroke="url(#brandGlow1)" strokeWidth="2.5" />
          <path d="M-60 505 C 440 345, 900 545, 1520 245" stroke="url(#brandGlow2)" strokeWidth="1.5" strokeDasharray="8 8" />
          <defs>
            <linearGradient id="brandGlow1" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0" />
              <stop offset="45%" stopColor="#2DD4BF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="brandGlow2" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> Smarter from your couch
          </span>
          <h1 className="font-display mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]">
            Life is complicated enough.
            <span className="mt-1 block bg-gradient-to-r from-[#2DD4BF] via-[#34D399] to-[#38BDF8] bg-clip-text text-transparent">
              Getting things done shouldn't be.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Smart tools for life's frustrating decisions. Save money, save time, and take control — without leaving home.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => document.getElementById('paths')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="vp-btn-emerald inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-extrabold text-white transition"
            >
              Choose Your Path <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/auto/rescue')}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-6 py-3.5 text-sm font-extrabold text-white backdrop-blur-md transition hover:bg-white/14"
            >
              Check My Car Warranty Refund
            </button>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Free calculators, always</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Zero spam — we never sell your number</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> You stay in control of every send</span>
          </div>
        </div>
      </section>

      {/* SIX PATHS */}
      <section id="paths" className="relative z-20 mx-auto -mt-24 max-w-7xl scroll-mt-28 px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BRAND_PATHS.map((p) => {
            const flagship = p.id === 'auto';
            return (
              <button
                key={p.id}
                onClick={() => navigate(p.path)}
                className={`group flex flex-col justify-between rounded-[26px] border p-6 text-left transition duration-300 hover:-translate-y-1 ${
                  flagship
                    ? 'vp-hero-canvas border-teal-400/40 text-white shadow-[0_28px_60px_-15px_rgba(6,24,46,0.5)]'
                    : 'border-white bg-white text-[#071930] shadow-[0_22px_50px_-14px_rgba(6,24,46,0.16)] hover:shadow-[0_28px_60px_-12px_rgba(6,24,46,0.25)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        flagship ? 'bg-white/10 text-teal-300 ring-1 ring-white/20' : 'bg-emerald-50 text-[#059669] ring-1 ring-emerald-200/80'
                      }`}
                    >
                      {p.icon}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        flagship ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-[#059669]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {p.status}
                    </span>
                  </div>
                  <h2 className="font-display mt-4 text-2xl font-extrabold">{p.label}</h2>
                  <p className={`mt-1.5 text-sm ${flagship ? 'text-slate-300' : 'text-slate-600'}`}>{p.desc}</p>
                  <div
                    className={`mt-4 rounded-2xl px-3.5 py-2.5 text-xs ${
                      flagship ? 'border border-white/10 bg-white/[0.06] text-slate-200' : 'border border-slate-200 bg-[#F4F8FC] text-slate-700'
                    }`}
                  >
                    <span className={`font-bold ${flagship ? 'text-teal-300' : 'text-[#0B4F9C]'}`}>Try now: </span>
                    {p.liveTool}
                  </div>
                </div>
                <span
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold ${flagship ? 'text-emerald-300' : 'text-[#059669]'}`}
                >
                  Open {p.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* WHAT MAKES US DIFFERENT */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#059669]">What makes us different</span>
            <h2 className="font-display mt-2 text-3xl font-extrabold leading-tight text-[#071930] sm:text-4xl">
              Other sites tell you what to do. We help you actually do it.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              No 2,000-word articles. Every tool moves you closer to a measurable outcome — a number, a letter, an email or a checklist you can use today.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="vp-card overflow-hidden">
              <div className="grid grid-cols-2 border-b border-slate-200 bg-[#F4F8FC] text-[11px] font-extrabold uppercase tracking-wider">
                <div className="flex items-center gap-2 px-5 py-3.5 text-slate-500">
                  <BookOpen className="h-4 w-4" /> Traditional approach
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 px-5 py-3.5 text-[#059669]">
                  <Zap className="h-4 w-4" /> VantagePaths approach
                </div>
              </div>
              {compare.map(([oldWay, newWay, path]) => (
                <button
                  key={oldWay}
                  onClick={() => navigate(path)}
                  className="group grid w-full grid-cols-2 border-b border-slate-100 text-left text-sm last:border-b-0 hover:bg-emerald-50/40"
                >
                  <div className="px-5 py-3.5 text-slate-500 line-through decoration-slate-300">{oldWay}</div>
                  <div className="flex items-center justify-between gap-2 border-l border-slate-100 px-5 py-3.5 font-semibold text-[#071930]">
                    <span>{newWay}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#059669] opacity-0 transition group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="vp-hero-canvas rounded-[32px] p-8 text-white sm:p-12">
          <div className="max-w-2xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-teal-300">How it works</span>
            <h2 className="font-display mt-2 text-3xl font-extrabold">Three steps. Every path.</h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              ['01', 'Tell us your situation', 'Your bill, contract, loan or charge — in plain numbers. No account required.'],
              ['02', 'See the math, free', 'Instant savings, deadlines and benchmarks so you know exactly where you stand.'],
              ['03', 'Get it done', 'Unlock a ready-to-send letter, email or script for $14 — or every packet for 60 days at $29.'],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-sm">
                <div className="font-mono text-sm font-bold text-emerald-300">{n}</div>
                <h3 className="font-display mt-2 text-lg font-extrabold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 pb-6 sm:px-6">
        <div className="max-w-2xl">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#0B4F9C]">Simple, transparent pricing</span>
          <h2 className="font-display mt-1.5 text-3xl font-extrabold text-[#071930] sm:text-4xl">
            Free answers. Pay only for the finished product.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <PriceTier
            badge="FREE FOREVER"
            title="Every Calculator & Benchmark"
            price="$0"
            unit="no card required"
            items={['Savings, deadlines & benchmarks on every path', 'Live NHTSA VIN recalls & 50-state laws', 'Free red-flag preview on uploaded contracts', 'Zero spam — no phone number required']}
            cta="Start With a Free Tool"
            onClick={() => document.getElementById('paths')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
          <PriceTier
            badge="MOST POPULAR"
            title="60-Day All-Access Pass"
            price="$29"
            unit="one-time • or $14 per packet"
            featured
            items={['Every letter, email & script across all paths', 'Downloadable branded PDF packets', 'Follow-up & escalation templates', 'No subscription — no auto-renewal']}
            cta="Build My First Packet"
            onClick={() => navigate('/auto/rescue')}
          />
          <PriceTier
            badge="OPTIONAL ADD-ON"
            title="1-Click Certified Mail"
            price="+$15"
            unit="per physical letter"
            items={['You review & sign — we handle the mailing', 'USPS return-receipt proof of delivery', 'No post office trip', '100% self-service (not legal representation)']}
            cta="See How It Works"
            onClick={() => navigate('/auto/rescue')}
          />
        </div>
      </section>
    </main>
  );
};

const NavLink: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
      active
        ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 text-teal-200 shadow-xs ring-1 ring-teal-400/35'
        : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
    }`}
  >
    {children}
  </button>
);

const ShowcaseHomePage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  // Interactive Live Command Sandbox (Loan Rescue Quick Check + Live VIN Quick Check)
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
      {/* ===================================================================
          ARCHITECTURAL MIDNIGHT-TO-TEAL SHOWCASE HERO (NO STOCK CAR PHOTO!)
      =================================================================== */}
      <section className="vp-hero-canvas relative overflow-hidden pb-32 pt-12 text-white sm:pb-36 sm:pt-16">
        {/* Flowing glowing S-path vector accents */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 1440 520"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M-60 440 C 360 290, 820 490, 1520 175"
            stroke="url(#homeGlow1)"
            strokeWidth="2.5"
          />
          <path
            d="M-60 475 C 420 330, 880 515, 1520 230"
            stroke="url(#homeGlow2)"
            strokeWidth="1.5"
            strokeDasharray="8 8"
          />
          <defs>
            <linearGradient id="homeGlow1" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0" />
              <stop offset="45%" stopColor="#2DD4BF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="homeGlow2" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-4xl">
            {/* Eyebrow Bar matching mockup */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-display text-base font-extrabold tracking-tight text-white">
                Vantage<span className="italic text-[#2DD4BF]">Paths</span>
              </span>
              <span className="h-4 w-px bg-white/25" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                THE 4-PILLAR ADVANTAGE PLATFORM
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-0.5 text-[11px] font-bold text-emerald-300 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% Independent • All 50 States + DC
              </span>
            </div>

            {/* Two-Tone Display Headline matching mockup */}
            <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              <span>Every Hated Car-Ownership Chore</span>
              <span className="mt-1.5 block bg-gradient-to-r from-[#2DD4BF] via-[#34D399] to-[#38BDF8] bg-clip-text text-transparent">
                — Solved From Home
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-200 sm:text-lg">
              Do everything you hate about owning a car — smarter, from your couch.
            </p>

            {/* Frosted-Glass 4-Action Pill Bar (Compare | Save | Protect | Upgrade) */}
            <div className="mt-7 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-white/20 bg-white/[0.08] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-md sm:rounded-full sm:px-2">
              <HeroPill
                icon={<Sofa className="h-4 w-4 text-[#2DD4BF]" />}
                label="Compare"
                onClick={() => navigate('/buy')}
              />
              <span className="hidden h-4 w-px bg-white/20 sm:inline-block" />
              <HeroPill
                icon={<Calculator className="h-4 w-4 text-[#34D399]" />}
                label="Save"
                onClick={() => navigate('/rescue')}
              />
              <span className="hidden h-4 w-px bg-white/20 sm:inline-block" />
              <HeroPill
                icon={<Shield className="h-4 w-4 text-[#38BDF8]" />}
                label="Protect"
                onClick={() => navigate('/insurance')}
              />
              <span className="hidden h-4 w-px bg-white/20 sm:inline-block" />
              <HeroPill
                icon={<RefreshCw className="h-4 w-4 text-[#2DD4BF]" />}
                label="Upgrade"
                onClick={() => navigate('/sell')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          4-COLUMN OVERLAPPING WAVE-TOP PILLAR CARDS (EXACT MOCKUP LAYOUT!)
      =================================================================== */}
      <section className="relative z-20 mx-auto -mt-24 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <WavePillarCard
            imageSrc="/images/pillar-buy.jpg"
            imageAlt="Buy a car remotely from your living room couch"
            icon={<Car className="h-5 w-5 text-[#0B4F9C]" />}
            kicker="PILLAR 1 • BUY FROM HOME"
            title="Couch-to-Keys Remote Deal Room"
            desc="Live NHTSA VIN recalls, 5-dealer blind email bid-war scripts, side-by-side quote comparison board, out-of-state shipping math, 4-square BS-detector, and pre-delivery contract PDF audits."
            cta="Open Buy-From-Home Room"
            buttonTone="sapphire"
            onClick={() => navigate('/buy')}
          />

          <WavePillarCard
            imageSrc="/images/pillar-rescue.jpg"
            imageAlt="Car loan reworked with extended warranty and GAP refund"
            icon={<Coins className="h-5 w-5 text-[#059669]" />}
            kicker="PILLAR 2 • HIGHEST ROI"
            title="2-Step Car Loan Rescue & Add-On Refunds"
            desc="Cancel overpriced Extended Warranties, GAP & F&I bundles to slash loan principal & LTV, unlock credit union auto refinancing, and generate ready-to-sign Cancellation + Day-14 Stall-Buster PDFs."
            cta="Run 2-Step Loan Rescue"
            buttonTone="emerald"
            featured
            onClick={() => navigate('/rescue')}
          />

          <WavePillarCard
            imageSrc="/images/pillar-insurance.jpg"
            imageAlt="Zero-spam auto insurance shield protection audit"
            icon={<Shield className="h-5 w-5 text-[#0B4F9C]" />}
            kicker="PILLAR 3 • EVERY 6 MONTHS"
            title="Zero-Spam Auto Insurance Audit"
            desc="Audit your Declarations Page for renewal loyalty penalties, deductible break-even math, and roadside CLUE traps — then export a 1-page Apples-to-Apples Quote Spec Sheet + set 6-month alerts."
            cta="Audit My Insurance Policy"
            buttonTone="sapphire"
            onClick={() => navigate('/insurance')}
          />

          <WavePillarCard
            imageSrc="/images/pillar-sell.jpg"
            imageAlt="Car key fob with max-cash trade and upgrade tag"
            icon={<Tag className="h-5 w-5 text-[#059669]" />}
            kicker="PILLAR 4 • MAX-CASH EXIT"
            title="Sell or Trade In Without Getting Lowballed"
            desc="Compare dealer trade-in (+ exact state sales tax credit!) vs. online instant cash offers vs. private party sale, backed by a zero-scam bank-verified payment & DMV checklist."
            cta="Optimize My Exit Path"
            buttonTone="emerald"
            onClick={() => navigate('/sell')}
          />
        </div>
      </section>

      {/* ===================================================================
          INTERACTIVE LIVE COMMAND SANDBOX (TEST DRIVE RIGHT ON OVERVIEW)
      =================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="vp-card overflow-hidden p-6 sm:p-10">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                <Sparkles className="h-3.5 w-3.5" /> Interactive Consumer Leverage Engine
              </span>
              <h2 className="font-display text-3xl font-extrabold leading-tight text-[#071930] sm:text-4xl">
                Skip 4-Hour Dealership Traps &amp; Insurance Spam Calls Forever.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Dealers and insurers rely on information asymmetry. Test-drive our live calculators right here — toggle packed F&amp;I add-ons to see your instant principal + interest recovery, or decode any 17-digit VIN directly against federal NHTSA databases.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricTile value="$2,400–$5,800" label="Typical F&I Add-On Principal Refund" />
                <MetricTile value="50 States + DC" label="Statutory Doc Caps & Refund Rules" />
                <MetricTile value="Zero Spam" label="Never Sells Your Phone Number" />
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => navigate('/rescue')}
                  className="vp-btn-emerald inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-extrabold text-white transition"
                >
                  Check My Warranty / GAP Refund <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/buy')}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-6 py-3.5 text-sm font-extrabold text-[#071930] transition hover:border-[#071930] hover:bg-white"
                >
                  Enter Remote Deal Room
                </button>
              </div>
            </div>

            {/* LIVE INTERACTIVE DUAL SANDBOX */}
            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-[#F4F8FC] p-2 shadow-inner">
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#071930]/8 p-1.5">
                  <button
                    onClick={() => setHeroTab('rescue')}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                      heroTab === 'rescue'
                        ? 'bg-[#071930] text-white shadow-md'
                        : 'text-slate-600 hover:text-[#071930]'
                    }`}
                  >
                    2-Step Loan Rescue Simulator
                  </button>
                  <button
                    onClick={() => setHeroTab('vin')}
                    className={`rounded-xl py-2.5 text-xs font-extrabold transition ${
                      heroTab === 'vin'
                        ? 'bg-[#071930] text-white shadow-md'
                        : 'text-slate-600 hover:text-[#071930]'
                    }`}
                  >
                    Live US Gov NHTSA VIN Check
                  </button>
                </div>

                {heroTab === 'rescue' ? (
                  <div className="space-y-3 p-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Toggle Packed Dealer Add-Ons (Sample Financed @ 8.89% APR)
                    </div>
                    {[
                      ['Extended Warranty (VSC)', '$3,495', '100% Optional • Direct administrator refund', chkVsc, setChkVsc],
                      ['Dealer GAP Waiver', '$1,195', 'Replace with ~$5/mo insurer GAP coverage', chkGap, setChkGap],
                      ['Tire, Wheel & Key Bundle', '$895', 'High-markup F&I ancillary contract', chkTire, setChkTire],
                    ].map(([lbl, price, sub, val, setter]: any, idx) => (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition ${
                          val
                            ? 'border-emerald-500/50 bg-white shadow-xs'
                            : 'border-slate-200/80 bg-slate-100/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) => setter(e.target.checked)}
                            className="h-4 w-4 accent-[#059669]"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-[#071930]">{lbl}</div>
                            <div className="text-[11px] text-slate-500">{sub}</div>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-extrabold text-[#071930]">{price}</span>
                      </label>
                    ))}

                    <div className="vp-hero-canvas rounded-2xl p-5 text-white shadow-lg">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[10.5px] font-bold uppercase tracking-wider text-teal-300">
                            Est. Principal Refund + Avoided Interest
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Slashes Loan-to-Value so credit unions approve your refinance!
                          </div>
                        </div>
                        <div className="font-mono text-3xl font-extrabold text-emerald-300">
                          ${totalRecover.toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/rescue')}
                        className="vp-btn-emerald mt-4 w-full rounded-full py-3 text-xs font-extrabold text-white transition"
                      >
                        Open 20-Provider Search &amp; Cancellation Generator →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Official Federal NHTSA Decoder (Instant Recall &amp; Defect Leverage)
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={17}
                        value={quickVin}
                        onChange={(e) => setQuickVin(e.target.value.toUpperCase())}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-[#071930] focus:border-[#0B4F9C] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={quickVinLoading}
                        onClick={runQuickVin}
                        className="vp-btn-sapphire rounded-xl px-5 py-2.5 text-xs font-extrabold text-white transition"
                      >
                        {quickVinLoading ? '...' : 'Decode VIN'}
                      </button>
                    </div>
                    {quickVinRes ? (
                      <div className="space-y-2 rounded-2xl border border-teal-200 bg-white p-4 text-xs shadow-xs">
                        <div className="font-extrabold text-[#071930]">
                          {quickVinRes.year} {quickVinRes.make} {quickVinRes.model} ({quickVinRes.trim})
                        </div>
                        <div className="font-mono text-[11px] font-bold text-[#0F766E]">
                          {quickVinRes.recallCount} Federal Recall(s) • {quickVinRes.complaintCount} NHTSA Complaints
                        </div>
                        <p className="leading-relaxed text-slate-600">{quickVinRes.negotiationInsight}</p>
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                        Click <strong>Decode VIN</strong> on the sample RAV4 Hybrid VIN above (or paste any 17-digit VIN from Cars.com / CarGurus) to pull live federal recalls and defect hotspots before bidding.
                      </p>
                    )}
                    <button
                      onClick={() => navigate('/buy')}
                      className="vp-btn-sapphire w-full rounded-full py-3 text-xs font-extrabold text-white transition"
                    >
                      Launch Full Couch-to-Keys Deal Room →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          EXECUTIVE PRICING & TRANSPARENT DUAL-REVENUE SECTION
      =================================================================== */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#059669]">
              SIMPLE PRICING &amp; TRANSPARENT MODEL
            </span>
            <h2 className="font-display mt-1.5 text-3xl font-extrabold text-[#071930] sm:text-4xl">
              Free Calculators Forever. Pay Only When You Generate Sign-Ready Packets.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-600">
            100% independent of dealership kickbacks. Every calculator, VIN lookup, and state fee cap is free — unlock individual letters for $14 or unlimited 60-day packets for $29.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            unit="one-time • or $14 single kit"
            featured
            items={[
              'Unlimited OTD, TILA & Insurance PDF Audits',
              'State-Specific Warranty & GAP Cancellation PDF',
              'Day-14 Dealer Stall-Buster Escalation Letter',
              'Round 1 & Round 2 Multi-Dealer Bid-War Emails',
            ]}
            cta="Build My Refund or Bid Packet"
            onClick={() => navigate('/rescue')}
          />

          <PriceTier
            badge="OPTIONAL ADD-ON"
            title="1-Click USPS Certified Mail"
            price="+$15"
            unit="per physical packet"
            items={[
              'You Review & Sign Your Own Cancellation Notice',
              'Physical USPS Return-Receipt Proof to Admin + F&I',
              'Zero Post Office Lines or Finance-Desk Stalling',
              '100% Self-Service (Zero Legal Representation)',
            ]}
            cta="Preview Cancellation Mail Flow"
            onClick={() => navigate('/rescue')}
          />
        </div>

        {/* Curated Partner Strip */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
      </section>

      {/* ===================================================================
          50-STATE STATUTORY QUICK-JUMP BAR
      =================================================================== */}
      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
        <div className="vp-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#0B4F9C]">
                50 STATES + DC STATUTORY DATABASE
              </span>
              <h2 className="font-display mt-1 text-2xl font-extrabold text-[#071930]">
                Check Your State's Dealer Doc Fee Cap, Trade Tax Credit &amp; Refund Window
              </h2>
            </div>
            <button
              onClick={() => navigate('/states')}
              className="vp-btn-sapphire inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-extrabold text-white transition"
            >
              View All States <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['CA', 'TX', 'FL', 'NY', 'OH', 'GA', 'NC', 'VA', 'IL', 'PA', 'WA', 'AZ', 'CO', 'NJ', 'MI'].map((code) => (
              <button
                key={code}
                onClick={() => navigate(`/state/${code}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F4F8FC] px-4 py-2 font-mono text-xs font-bold text-[#071930] transition hover:border-[#0B4F9C] hover:bg-white hover:text-[#0B4F9C] hover:shadow-sm"
              >
                <MapPin className="h-3.5 w-3.5 text-[#059669]" /> {code}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

const HeroPill: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/14 sm:text-sm"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const WavePillarCard: React.FC<{
  imageSrc: string;
  imageAlt: string;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  buttonTone: 'sapphire' | 'emerald';
  featured?: boolean;
  onClick: () => void;
}> = ({ imageSrc, imageAlt, icon, kicker, title, desc, cta, buttonTone, featured = false, onClick }) => (
  <div
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onClick();
    }}
    className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[26px] border bg-white transition duration-300 hover:-translate-y-1.5 ${
      featured
        ? 'border-emerald-300/90 shadow-[0_24px_55px_-12px_rgba(5,150,105,0.22)] hover:shadow-[0_30px_65px_-12px_rgba(5,150,105,0.3)]'
        : 'border-white/90 shadow-[0_22px_50px_-14px_rgba(6,24,46,0.16)] hover:shadow-[0_28px_60px_-12px_rgba(6,24,46,0.25)]'
    }`}
  >
    <div>
      {/* Top Photorealistic Header + Smooth S-Curve Wave Divider */}
      <div className="relative h-46 w-full overflow-hidden bg-[#06182E]">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06182E]/35 via-transparent to-transparent" />
        {/* Smooth S-Wave Mask matching attached mockup */}
        <svg
          className="pointer-events-none absolute -bottom-px left-0 w-full text-white"
          viewBox="0 0 400 34"
          fill="currentColor"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,18 C110,36 260,-4 400,16 L400,34 L0,34 Z" />
        </svg>
      </div>

      {/* Card Body */}
      <div className="px-6 pb-4 pt-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              buttonTone === 'sapphire'
                ? 'bg-sky-50 ring-1 ring-sky-200/80'
                : 'bg-emerald-50 ring-1 ring-emerald-200/80'
            }`}
          >
            {icon}
          </div>
          <span
            className={`font-mono text-[10.5px] font-extrabold uppercase tracking-wider ${
              buttonTone === 'sapphire' ? 'text-[#0B4F9C]' : 'text-[#059669]'
            }`}
          >
            {kicker}
          </span>
        </div>

        <h2 className="font-display mt-3 text-[1.28rem] font-extrabold leading-snug text-[#071930]">
          {title}
        </h2>
        <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{desc}</p>
      </div>
    </div>

    {/* Pill CTA Button */}
    <div className="px-6 pb-6 pt-2">
      <span
        className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-extrabold text-white transition ${
          buttonTone === 'sapphire' ? 'vp-btn-sapphire' : 'vp-btn-emerald'
        }`}
      >
        <span>{cta}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </div>
);

const MetricTile: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-[#F4F8FC] p-3.5">
    <div className="font-mono text-sm font-extrabold text-[#071930]">{value}</div>
    <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{label}</div>
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
    className={`flex flex-col justify-between rounded-3xl p-7 transition ${
      featured
        ? 'vp-hero-canvas border border-teal-400/35 text-white shadow-[0_26px_60px_-15px_rgba(6,24,46,0.45)]'
        : 'vp-card text-[#071930]'
    }`}
  >
    <div>
      <span
        className={`inline-block rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
          featured
            ? 'border border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
            : 'border border-slate-200 bg-[#F4F8FC] text-slate-600'
        }`}
      >
        {badge}
      </span>
      <h3 className={`font-display mt-3.5 text-lg font-extrabold ${featured ? 'text-white' : 'text-[#071930]'}`}>
        {title}
      </h3>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="font-display text-4xl font-extrabold">{price}</span>
        <span className={`text-xs font-semibold ${featured ? 'text-slate-300' : 'text-slate-500'}`}>{unit}</span>
      </div>
      <ul className={`mt-5 space-y-2.5 text-xs font-medium ${featured ? 'text-slate-200' : 'text-slate-700'}`}>
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2
              className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? 'text-emerald-300' : 'text-[#059669]'}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
    <button
      onClick={onClick}
      className={`mt-7 w-full rounded-full py-3 text-xs font-extrabold transition ${
        featured
          ? 'vp-btn-emerald text-white'
          : 'border border-slate-300 bg-[#F4F8FC] text-[#071930] hover:border-[#071930] hover:bg-white'
      }`}
    >
      {cta}
    </button>
  </div>
);

export default App;
