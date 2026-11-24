import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Car,
  CheckCircle2,
  Compass,
  FileSignature,
  Hammer,
  Home,
  Mail,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { AuditVerticalId, PublicAuditResponse } from './shared/types';
import { AuditWorkspace } from './components/AuditWorkspace';
import { FreeCalculators } from './components/FreeCalculators';
import { AdminFunnelView } from './components/AdminFunnelView';

type RoutePath = '/' | '/freight' | '/auto' | '/home-bids' | '/contracts' | '/housing' | '/admin';

function normalizeRoute(pathname: string): RoutePath {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (
    clean === '/freight' ||
    clean === '/auto' ||
    clean === '/home-bids' ||
    clean === '/contracts' ||
    clean === '/housing' ||
    clean === '/admin'
  ) {
    return clean;
  }
  return '/';
}

const VERTICAL_META: Record<
  AuditVerticalId,
  {
    name: string;
    short: string;
    tagline: string;
    priceTag: string;
    avgSavings: string;
    icon: React.FC<{ className?: string }>;
    accentText: string;
    accentBorder: string;
  }
> = {
  freight: {
    name: 'Freight Invoice & Rate-Con Audit',
    short: 'Freight',
    tagline:
      'Catch inflated fuel surcharges, unauthorized detention/accessorials, duplicate lumpers, and unprofitable broker loads in 30 seconds.',
    priceTag: '$29 / 15-Audit Pack • $79/mo Pro',
    avgSavings: 'Avg $480–$1,400 saved per dispute',
    icon: Truck,
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/40',
  },
  auto: {
    name: 'Auto Deal, OTD & Lease Audit',
    short: 'Auto Deals',
    tagline:
      'Expose hidden dealer add-ons, bogus doc/prep fees, APR reserve markups, and inflated lease money factors before you walk into F&I.',
    priceTag: '$24 30-Day Buyer Pass • $79/mo Broker',
    avgSavings: 'Avg $1,800–$4,500 saved per car',
    icon: Car,
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/40',
  },
  'home-bids': {
    name: 'Contractor Bid & Storm Claim Audit',
    short: 'Home Bids',
    tagline:
      'Audit roof, HVAC, solar, remodel quotes, and insurance Xactimate claims against fair regional pricing and mandatory IRC building codes.',
    priceTag: '$29 Project Pass • $79/mo Property Pro',
    avgSavings: 'Avg $2,200–$8,500 saved or recovered',
    icon: Hammer,
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/40',
  },
};

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => normalizeRoute(window.location.pathname));
  const [hubVertical, setHubVertical] = useState<AuditVerticalId>('freight');
  const [verifiedAudit, setVerifiedAudit] = useState<PublicAuditResponse | null>(null);
  const [verifyBanner, setVerifyBanner] = useState<string | null>(null);

  const navigate = (next: RoutePath) => {
    if (next !== route) {
      window.history.pushState({}, '', next);
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const onPop = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Automatically verify Stripe Checkout return (?unlocked=1&session_id=...&audit_id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlocked = params.get('unlocked');
    const sessionId = params.get('session_id');
    const auditId = params.get('audit_id');

    if (unlocked === '1' && sessionId && auditId) {
      fetch(
        `/api/billing/verify?session_id=${encodeURIComponent(sessionId)}&audit_id=${encodeURIComponent(
          auditId
        )}`
      )
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Verification failed');
          setVerifiedAudit(data as PublicAuditResponse);
          setVerifyBanner('Payment verified — your full audit report, counter-offer script & PDF are unlocked!');
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((err) => {
          setVerifyBanner(`Stripe verification notice: ${err.message}`);
        });
    } else if (auditId) {
      fetch(`/api/audit/${encodeURIComponent(auditId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setVerifiedAudit(data as PublicAuditResponse);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Unified Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white">
                Vantage<span className="text-emerald-400">Paths</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Deal, Quote & Contract Audit Hub
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            <NavBtn active={route === '/'} onClick={() => navigate('/')}>
              Hub
            </NavBtn>
            <NavBtn active={route === '/freight'} onClick={() => navigate('/freight')}>
              Freight
            </NavBtn>
            <NavBtn active={route === '/auto'} onClick={() => navigate('/auto')}>
              Auto Deals
            </NavBtn>
            <NavBtn active={route === '/home-bids'} onClick={() => navigate('/home-bids')}>
              Home Bids
            </NavBtn>
            <NavBtn active={route === '/contracts'} onClick={() => navigate('/contracts')}>
              Contracts
            </NavBtn>
            <NavBtn active={route === '/housing'} onClick={() => navigate('/housing')}>
              Housing
            </NavBtn>
          </nav>

          <button
            onClick={() => navigate('/admin')}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              route === '/admin'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Funnel
          </button>
        </div>

        {/* Mobile Nav Strip */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-900 px-4 py-2 md:hidden">
          {(['/', '/freight', '/auto', '/home-bids', '/contracts', '/housing'] as RoutePath[]).map(
            (r) => (
              <NavBtn key={r} active={route === r} onClick={() => navigate(r)}>
                {r === '/' ? 'Hub' : r.slice(1)}
              </NavBtn>
            )
          )}
        </div>
      </header>

      {verifyBanner && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-xs font-medium text-emerald-300">
          {verifyBanner}
        </div>
      )}

      {/* Route Views */}
      {route === '/' && (
        <HubHomePage
          activeVertical={hubVertical}
          setActiveVertical={setHubVertical}
          navigate={navigate}
          verifiedAudit={verifiedAudit}
        />
      )}

      {(route === '/freight' || route === '/auto' || route === '/home-bids') && (
        <DedicatedVerticalPage
          vertical={route.slice(1) as AuditVerticalId}
          initialAudit={verifiedAudit}
          navigate={navigate}
        />
      )}

      {(route === '/contracts' || route === '/housing') && (
        <WaitlistVerticalPage vertical={route.slice(1) as 'contracts' | 'housing'} navigate={navigate} />
      )}

      {route === '/admin' && <AdminFunnelView />}

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-semibold text-slate-400">
            VantagePaths.com — See Every Hidden Fee, Overcharge & Trap Before You Sign or Pay.
          </p>
          <p className="mt-1.5">
            Informational deal & invoice audit benchmarks powered by deterministic verifiers + $0 free-tier multimodal AI. Not legal, tax, or licensed adjusting advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

const NavBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
      active
        ? 'bg-slate-800 text-emerald-400'
        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const HubHomePage: React.FC<{
  activeVertical: AuditVerticalId;
  setActiveVertical: (v: AuditVerticalId) => void;
  navigate: (r: RoutePath) => void;
  verifiedAudit: PublicAuditResponse | null;
}> = ({ activeVertical, setActiveVertical, navigate, verifiedAudit }) => {
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      {/* Hero */}
      <section className="text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> 3 Live Audit Engines • Free Red-Flag Preview • Pay Only to Unlock Full Report
        </div>
        <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Audit Any High-Stakes Quote, Invoice, or Bid in{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
            30 Seconds
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Upload a freight invoice, car dealership OTD worksheet, or contractor roof bid. VantagePaths flags hidden overcharges, compares fair US market benchmarks, and writes your word-for-word counter-offer email.
        </p>

        {/* Quick Vertical Selector Pills */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          {(['freight', 'auto', 'home-bids'] as AuditVerticalId[]).map((v) => {
            const meta = VERTICAL_META[v];
            const Icon = meta.icon;
            const active = activeVertical === v;
            return (
              <button
                key={v}
                onClick={() => setActiveVertical(v)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Icon className={`h-4 w-4 ${meta.accentText}`} />
                {meta.short}
                <span className="rounded-md bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                  LIVE
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Shared Audit Engine right on Homepage */}
      <section>
        <AuditWorkspace vertical={activeVertical} initialAudit={verifiedAudit} />
      </section>

      {/* 5 Vertical Paths Directory */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              The VantagePaths Ecosystem
            </span>
            <h2 className="text-2xl font-bold text-white">5 High-Value Audit Paths Under One Roof</h2>
          </div>
          <p className="text-xs text-slate-400">
            Phase 1 (3 Verticals Live Today) • Phase 2 Waitlist Open
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(['freight', 'auto', 'home-bids'] as AuditVerticalId[]).map((v) => {
            const m = VERTICAL_META[v];
            const Icon = m.icon;
            return (
              <div
                key={v}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-emerald-500/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 border border-slate-800">
                      <Icon className={`h-5 w-5 ${m.accentText}`} />
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                      Phase 1 • Live
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{m.name}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.tagline}</p>
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-800 pt-4">
                  <div className="text-xs font-semibold text-emerald-300">{m.avgSavings}</div>
                  <div className="font-mono text-[11px] text-slate-400">{m.priceTag}</div>
                  <button
                    onClick={() => navigate(`/${v}` as RoutePath)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 hover:text-slate-950"
                  >
                    Open {m.short} Workspace & Free Calculator <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Phase 2 Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Phase2Card
            icon={<FileSignature className="h-5 w-5 text-violet-400" />}
            title="SMB Contract, SaaS & Vendor Bill Audit"
            desc="Catch auto-renewal traps, uncapped liability clauses, and sneaky SaaS/telecom fee creep before your 60-day cancellation window closes."
            price="$29/scan • $59/mo Business"
            onClick={() => navigate('/contracts')}
          />
          <Phase2Card
            icon={<Home className="h-5 w-5 text-cyan-400" />}
            title="Housing Buy vs. Rent & Property Tax Protest"
            desc="Run 5,000-path equity/interest simulations and generate county property tax protest evidence packets."
            price="$39 Protest Packet • $49/mo Pro"
            onClick={() => navigate('/housing')}
          />
        </div>
      </section>
    </main>
  );
};

const Phase2Card: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  price: string;
  onClick: () => void;
}> = ({ icon, title, desc, price, onClick }) => (
  <div className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:gap-5">
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
          Phase 2 • Early Access
        </span>
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-slate-400">{desc}</p>
      <div className="font-mono text-[11px] text-slate-500">{price}</div>
    </div>
    <button
      onClick={onClick}
      className="mt-4 shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white sm:mt-0"
    >
      Join Waitlist
    </button>
  </div>
);

const DedicatedVerticalPage: React.FC<{
  vertical: AuditVerticalId;
  initialAudit: PublicAuditResponse | null;
  navigate: (r: RoutePath) => void;
}> = ({ vertical, initialAudit, navigate }) => {
  const meta = VERTICAL_META[vertical];
  const Icon = meta.icon;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
            <Icon className={`h-3.5 w-3.5 ${meta.accentText}`} />
            vantagepaths.com/{vertical}
          </div>
          <h1 className="text-3xl font-extrabold text-white">{meta.name}</h1>
          <p className="text-sm text-slate-400">{meta.tagline}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-right">
          <div className="text-xs font-bold text-emerald-400">{meta.avgSavings}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">{meta.priceTag}</div>
        </div>
      </div>

      <AuditWorkspace vertical={vertical} initialAudit={initialAudit} />

      <FreeCalculators vertical={vertical} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="text-sm text-slate-300">
          Need to audit a different document? Switch to another live VantagePaths workspace:
        </div>
        <div className="flex flex-wrap gap-2">
          {(['freight', 'auto', 'home-bids'] as AuditVerticalId[])
            .filter((v) => v !== vertical)
            .map((v) => (
              <button
                key={v}
                onClick={() => navigate(`/${v}` as RoutePath)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white"
              >
                {VERTICAL_META[v].short} Auditor →
              </button>
            ))}
        </div>
      </div>
    </main>
  );
};

const WaitlistVerticalPage: React.FC<{
  vertical: 'contracts' | 'housing';
  navigate: (r: RoutePath) => void;
}> = ({ vertical, navigate }) => {
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isContracts = vertical === 'contracts';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, vertical, notes }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Unable to join waitlist.');
    else {
      setStatus(data.message);
      setEmail('');
      setNotes('');
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-7">
        <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
          Phase 2 Expansion • Early Access Waitlist
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-white">
          {isContracts
            ? 'SMB Contract, SaaS & Vendor Bill Audit'
            : 'Housing Buy vs. Rent & Property Tax Protest'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {isContracts
            ? 'We are launching Phase 2 for MSAs, commercial leases, SaaS auto-renewal traps, and vendor invoice audits once our Phase 1 Freight, Auto & Home Bid engines complete initial traction.'
            : 'We are launching Phase 2 for 5,000-path housing equity/mortgage simulations and county property tax protest evidence packets.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
            >
              <Mail className="h-4 w-4" /> Reserve Early Access
            </button>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional: What type of contract or property scenario do you want audited first?"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </form>

        {status && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {status}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400">
          Want to try our live engines right now?{' '}
          <button onClick={() => navigate('/freight')} className="text-emerald-400 underline">
            Freight
          </button>
          ,{' '}
          <button onClick={() => navigate('/auto')} className="text-sky-400 underline">
            Auto Deals
          </button>
          , or{' '}
          <button onClick={() => navigate('/home-bids')} className="text-amber-400 underline">
            Home Bids
          </button>
          .
        </div>
      </div>
    </main>
  );
};

export default App;
