import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import type { AuditFinding, PublicAuditResponse } from '../shared/types';
import { LockedGeneratorCard } from './LockedGeneratorCard';
import { PageHeroBanner } from './PageHeroBanner';

export type LifeVerticalId = 'home' | 'money' | 'tech' | 'protect' | 'life';

interface ToolResult {
  toolId: string;
  headline: string;
  metrics: Array<{ label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }>;
  flags: AuditFinding[];
}

interface VerticalConfig {
  toolId: string;
  kicker: string;
  titleWhite: string;
  titleAccent: string;
  subtitle: string;
  toolKicker: string;
  toolTitle: string;
  toolDesc: string;
  pills: string[];
  lockedHeadline: string;
  lockedSub: string;
  lockedBullets: string[];
  nextTools: string[];
}

export const LIFE_VERTICALS: Record<LifeVerticalId, VerticalConfig> = {
  home: {
    toolId: 'home-internet',
    kicker: 'VantagePaths Home • Bills & Household Services',
    titleWhite: 'Stop Paying the',
    titleAccent: 'Loyalty Penalty',
    subtitle:
      'Internet and cable companies quietly raise rates after the promo ends. Benchmark your bill against new-customer pricing, then get a ready-to-send retention request and call script.',
    toolKicker: 'Live Tool • Internet & Cable Bill Negotiator',
    toolTitle: 'How Much Are You Overpaying for Internet?',
    toolDesc: 'Enter your current bill. We benchmark it against new-customer pricing for your speed tier and flag equipment fees you can eliminate.',
    pills: ['Benchmark', 'Negotiate', 'Switch Safely'],
    lockedHeadline: 'Unlock Your Internet Retention Email, Call Script & Switch Checklist',
    lockedSub: 'Pre-filled with your provider, account, speed tier and competing price — send it through chat or messages so there\'s a written record.',
    lockedBullets: [
      'Written rate-review request addressed to the retention department',
      'Word-for-word retention call script (including the "cancel" menu trick)',
      'Equipment-fee removal request + safe-switch checklist + downloadable PDF',
    ],
    nextTools: ['Utility bill rate checker', 'Moving & address-change checklist', 'Home warranty cancellation letter'],
  },
  money: {
    toolId: 'money-apr',
    kicker: 'VantagePaths Money • Fees, Rates & Bills',
    titleWhite: 'Ask for a Lower Rate —',
    titleAccent: 'With the Math to Back It Up',
    subtitle:
      'Card issuers lower APRs and reverse fees for customers who ask the right way. See exactly what your rate costs you, then send a request built for your account.',
    toolKicker: 'Live Tool • APR Reduction & Fee Reversal Builder',
    toolTitle: 'What Is Your Credit Card Rate Really Costing You?',
    toolDesc: 'Enter your balance and APR. We calculate your yearly interest, a realistic target rate, and fees worth requesting back.',
    pills: ['Calculate', 'Request', 'Recover Fees'],
    lockedHeadline: 'Unlock Your APR Reduction Letter, Call Script & Balance-Transfer Guide',
    lockedSub: 'Written for your issuer, balance, rate and payment history — send through the secure message center, then follow up by phone.',
    lockedBullets: [
      'Written APR reduction + late fee reversal request',
      'Phone script with fallback asks (promo rate, hardship program, supervisor)',
      'Balance-transfer break-even guidance + downloadable PDF',
    ],
    nextTools: ['Bank overdraft fee reversal letter', 'Medical bill itemization request', 'Personal loan comparison'],
  },
  tech: {
    toolId: 'tech-phone',
    kicker: 'VantagePaths Tech • Devices, Plans & Digital Simplification',
    titleWhite: 'Right-Size Your Phone Plan',
    titleAccent: 'in 2 Minutes',
    subtitle:
      'Most families pay for "unlimited" they don\'t use. Compare your per-line cost against plans on the same networks, and switch or negotiate without losing your numbers.',
    toolKicker: 'Live Tool • Cell Phone Plan Right-Sizer',
    toolTitle: 'Are You Overpaying Per Line?',
    toolDesc: 'Enter your bill, lines and typical data use. We separate device payments from service and benchmark your real per-line price.',
    pills: ['Compare', 'Negotiate', 'Port Safely'],
    lockedHeadline: 'Unlock Your Carrier Retention Request & Safe Number-Port Checklist',
    lockedSub: 'Built from your carrier, line count, usage and current cost — plus the exact steps to switch without losing a number.',
    lockedBullets: [
      'Written loyalty/retention request for your carrier',
      'Device-protection review and add-on removal asks',
      'Step-by-step safe number-port checklist + downloadable PDF',
    ],
    nextTools: ['Streaming & software bundle optimizer', 'Home Wi-Fi troubleshooting checklist', 'Device trade-in value checker'],
  },
  protect: {
    toolId: 'protect-dispute',
    kicker: 'VantagePaths Protect • Refunds, Disputes & Contracts',
    titleWhite: 'Get Your Money Back —',
    titleAccent: 'Before the Deadline',
    subtitle:
      'Charged for something you never got, cancelled, or that arrived broken? Find your written dispute deadline and generate the letters your card issuer and the merchant need to see.',
    toolKicker: 'Live Tool • Charge Dispute & Refund Builder',
    toolTitle: 'How Many Days Do You Have to Dispute?',
    toolDesc: 'Enter the charge and your statement date. We calculate your 60-day written dispute window and what to do first.',
    pills: ['Deadline', 'Dispute', 'Document'],
    lockedHeadline: 'Unlock Your Billing-Error Dispute Letter, Merchant Demand Letter & Evidence Checklist',
    lockedSub: 'Pre-filled with the merchant, amount, dates and reason — send to the billing-error address on your statement.',
    lockedBullets: [
      'Written billing-error dispute letter to your card issuer or bank',
      'Merchant refund demand letter with a 10-day deadline',
      'Evidence checklist + CFPB escalation steps + downloadable PDF',
    ],
    nextTools: ['Contract red-flag scanner', 'Security deposit return letter', 'Warranty claim letter'],
  },
  life: {
    toolId: 'life-subscriptions',
    kicker: 'VantagePaths Everyday Life • Subscriptions & Paperwork',
    titleWhite: 'Cancel What You',
    titleAccent: "Don't Use",
    subtitle:
      'Subscriptions creep up $10 at a time. See your real monthly total, pick what to cut, and get ready-to-send cancellation requests for every one.',
    toolKicker: 'Live Tool • Subscription Cancellation Center',
    toolTitle: 'What Are Your Subscriptions Costing You Per Year?',
    toolDesc: 'Adjust the list to match your accounts, mark what you rarely use, and select what to cancel.',
    pills: ['Total', 'Trim', 'Cancel'],
    lockedHeadline: 'Unlock Ready-to-Send Cancellation Emails for Every Selected Subscription',
    lockedSub: 'One request per service, written to stop recurring charges and get written confirmation.',
    lockedBullets: [
      'Individual cancellation email for each subscription you selected',
      'Gym & contract cancellation guidance (certified mail where required)',
      'Renewal-trap prevention checklist + downloadable PDF',
    ],
    nextTools: ['Free trial reminder tracker', 'Paperwork & document organizer', 'Annual-plan refund request'],
  },
};

export const LifeVerticalPage: React.FC<{ vertical: LifeVerticalId; navigate: (p: string) => void }> = ({
  vertical,
  navigate,
}) => {
  const cfg = LIFE_VERTICALS[vertical];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [kit, setKit] = useState<PublicAuditResponse | null>(null);

  const submit = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/life/${cfg.toolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setResult(data.result);
      setKit(data.kit);
      setTimeout(() => document.getElementById('life-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeroBanner
        kicker={cfg.kicker}
        titleWhite={cfg.titleWhite}
        titleAccent={cfg.titleAccent}
        subtitle={cfg.subtitle}
        pills={cfg.pills.map((p) => ({ label: p }))}
      />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <section className="vp-card p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#059669]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {cfg.toolKicker}
          </span>
          <h2 className="font-display mt-3 text-2xl font-extrabold text-[#071930] sm:text-3xl">{cfg.toolTitle}</h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-600">{cfg.toolDesc}</p>

          <div className="mt-6">
            {vertical === 'home' && <HomeInternetForm loading={loading} onSubmit={submit} />}
            {vertical === 'money' && <MoneyAprForm loading={loading} onSubmit={submit} />}
            {vertical === 'tech' && <TechPhoneForm loading={loading} onSubmit={submit} />}
            {vertical === 'protect' && <ProtectDisputeForm loading={loading} onSubmit={submit} />}
            {vertical === 'life' && <LifeSubscriptionsForm loading={loading} onSubmit={submit} />}
          </div>
          {error && <p className="mt-3 text-xs font-bold text-rose-700">{error}</p>}
        </section>

        {result && kit && (
          <section id="life-result" className="space-y-5 scroll-mt-28">
            <div className="vp-hero-canvas rounded-3xl p-6 text-white shadow-[0_24px_55px_-15px_rgba(6,24,46,0.45)] sm:p-8">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-teal-300">Your Free Results</span>
              <h3 className="font-display mt-1.5 text-2xl font-extrabold">{result.headline}</h3>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 md:grid-cols-4">
                {result.metrics.map((m, i) => (
                  <div key={i}>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{m.label}</div>
                    <div
                      className={`font-mono text-xl font-extrabold ${
                        m.tone === 'good'
                          ? 'text-emerald-300'
                          : m.tone === 'bad'
                          ? 'text-rose-300'
                          : m.tone === 'warn'
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.flags.map((f, i) => (
                <FlagCard key={i} flag={f} />
              ))}
            </div>

            <LockedGeneratorCard
              kit={kit}
              onKitUpdated={setKit}
              headline={cfg.lockedHeadline}
              subheadline={cfg.lockedSub}
              bullets={cfg.lockedBullets}
            />
          </section>
        )}

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="vp-card p-6 lg:col-span-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0B4F9C]">Also on this path</span>
            <h3 className="font-display mt-1 text-xl font-extrabold text-[#071930]">More tools rolling out next</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {cfg.nextTools.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F4F8FC] px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#059669]" /> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="vp-hero-canvas flex flex-col justify-between rounded-3xl p-6 text-white">
            <div>
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-teal-300">Our flagship path</span>
              <h3 className="font-display mt-1 text-xl font-extrabold">Own a car? Start with Auto.</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Buy from home, cancel packed warranties &amp; GAP, audit insurance and sell for max cash.
              </p>
            </div>
            <button
              onClick={() => navigate('/auto')}
              className="vp-btn-emerald mt-4 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-extrabold text-white"
            >
              Explore VantagePaths Auto <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
};

/* ---------------------------- Shared UI ---------------------------- */

const FlagCard: React.FC<{ flag: AuditFinding }> = ({ flag }) => {
  const Icon = flag.level === 'CRITICAL' ? ShieldAlert : flag.level === 'WARNING' ? AlertTriangle : Info;
  const tone =
    flag.level === 'CRITICAL'
      ? 'border-rose-200 bg-rose-50/80 text-rose-700'
      : flag.level === 'WARNING'
      ? 'border-amber-200 bg-amber-50/80 text-amber-700'
      : 'border-sky-200 bg-sky-50/80 text-sky-700';
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-sm font-extrabold text-[#071930]">{flag.title}</span>
        </div>
        {flag.estimatedImpactUsd ? (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-[#059669] shadow-xs">
            ~${flag.estimatedImpactUsd.toLocaleString()}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{flag.detail}</p>
    </div>
  );
};

const inputCls =
  'rounded-xl border border-slate-300 bg-[#F4F8FC] px-3 py-2.5 text-sm text-[#071930] focus:border-[#0B4F9C] focus:bg-white focus:outline-none';

const Num: React.FC<{ label: string; value: number; onChange: (v: number) => void; step?: string }> = ({
  label,
  value,
  onChange,
  step = '1',
}) => (
  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
    {label}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`${inputCls} font-mono`}
    />
  </label>
);

const Txt: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  label,
  value,
  onChange,
  placeholder,
}) => (
  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
    {label}
    <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
  </label>
);

const SubmitBtn: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    className="vp-btn-emerald inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-extrabold text-white transition disabled:opacity-60"
  >
    {loading ? 'Calculating...' : label} {!loading && <ArrowRight className="h-4 w-4" />}
  </button>
);

const LetterDetails: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <details className="rounded-2xl border border-slate-200 bg-[#F4F8FC] p-4">
    <summary className="cursor-pointer text-xs font-extrabold text-[#071930]">
      Optional: add your details to pre-fill the generated letter
    </summary>
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
  </details>
);

type FormProps = { loading: boolean; onSubmit: (p: Record<string, unknown>) => void };

/* ---------------------------- Tool Forms ---------------------------- */

const HomeInternetForm: React.FC<FormProps> = ({ loading, onSubmit }) => {
  const [provider, setProvider] = useState('Spectrum');
  const [current, setCurrent] = useState(110);
  const [equip, setEquip] = useState(15);
  const [months, setMonths] = useState(30);
  const [speed, setSpeed] = useState(500);
  const [compName, setCompName] = useState('');
  const [compPrice, setCompPrice] = useState(0);
  const [name, setName] = useState('');
  const [acct, setAcct] = useState('');
  const [addr, setAddr] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          provider,
          currentMonthlyUsd: current,
          equipmentFeeUsd: equip,
          monthsAsCustomer: months,
          speedMbps: speed,
          competitorName: compName,
          competitorMonthlyUsd: compPrice,
          customerName: name,
          accountNumber: acct,
          serviceAddress: addr,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Txt label="Internet Provider" value={provider} onChange={setProvider} />
        <Num label="Monthly Bill (before equipment) $" value={current} onChange={setCurrent} />
        <Num label="Equipment / Modem Fee $/mo" value={equip} onChange={setEquip} />
        <Num label="Months as Customer" value={months} onChange={setMonths} />
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Speed Tier
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className={inputCls}>
            <option value={100}>100 Mbps</option>
            <option value={300}>300 Mbps</option>
            <option value={500}>500 Mbps</option>
            <option value={1000}>1 Gig</option>
            <option value={2000}>2 Gig+</option>
          </select>
        </label>
        <Txt label="Competitor (optional)" value={compName} onChange={setCompName} placeholder="e.g. AT&T Fiber" />
        <Num label="Competitor Price $/mo (optional)" value={compPrice} onChange={setCompPrice} />
      </div>
      <LetterDetails>
        <Txt label="Your Name" value={name} onChange={setName} placeholder="Jordan Taylor" />
        <Txt label="Account #" value={acct} onChange={setAcct} placeholder="8347 1234 5678" />
        <Txt label="Service Address" value={addr} onChange={setAddr} placeholder="123 Main St, Dallas, TX" />
      </LetterDetails>
      <SubmitBtn loading={loading} label="Benchmark My Internet Bill (Free)" />
    </form>
  );
};

const MoneyAprForm: React.FC<FormProps> = ({ loading, onSubmit }) => {
  const [issuer, setIssuer] = useState('Capital One');
  const [balance, setBalance] = useState(6500);
  const [apr, setApr] = useState(27.99);
  const [years, setYears] = useState(4);
  const [onTime, setOnTime] = useState(true);
  const [band, setBand] = useState('good');
  const [lateFee, setLateFee] = useState(0);
  const [annualFee, setAnnualFee] = useState(0);
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          issuer,
          balanceUsd: balance,
          currentAprPct: apr,
          yearsAsCustomer: years,
          onTimeLast12: onTime,
          creditBand: band,
          lateFeeUsd: lateFee,
          annualFeeUsd: annualFee,
          customerName: name,
          cardLast4: last4,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Txt label="Card Issuer" value={issuer} onChange={setIssuer} />
        <Num label="Current Balance $" value={balance} onChange={setBalance} />
        <Num label="Current APR %" value={apr} step="0.01" onChange={setApr} />
        <Num label="Years as Cardholder" value={years} onChange={setYears} />
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Credit Standing
          <select value={band} onChange={(e) => setBand(e.target.value)} className={inputCls}>
            <option value="excellent">Excellent (740+)</option>
            <option value="good">Good (670–739)</option>
            <option value="fair">Fair (580–669)</option>
            <option value="rebuilding">Rebuilding (&lt;580)</option>
          </select>
        </label>
        <Num label="Recent Late Fee $ (optional)" value={lateFee} onChange={setLateFee} />
        <Num label="Annual Fee $ (optional)" value={annualFee} onChange={setAnnualFee} />
        <label className="flex items-end gap-2 pb-3 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={onTime} onChange={(e) => setOnTime(e.target.checked)} className="h-4 w-4 accent-[#059669]" />
          On time last 12 months
        </label>
      </div>
      <LetterDetails>
        <Txt label="Your Name" value={name} onChange={setName} placeholder="Jordan Taylor" />
        <Txt label="Card Last 4" value={last4} onChange={setLast4} placeholder="4821" />
      </LetterDetails>
      <SubmitBtn loading={loading} label="Calculate My Interest & Target Rate (Free)" />
    </form>
  );
};

const TechPhoneForm: React.FC<FormProps> = ({ loading, onSubmit }) => {
  const [carrier, setCarrier] = useState('Verizon');
  const [lines, setLines] = useState(3);
  const [bill, setBill] = useState(245);
  const [devices, setDevices] = useState(60);
  const [data, setData] = useState(8);
  const [ins, setIns] = useState(17);
  const [years, setYears] = useState(5);
  const [name, setName] = useState('');
  const [acct, setAcct] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          carrier,
          lines,
          monthlyBillUsd: bill,
          devicePaymentsUsd: devices,
          avgDataGbPerLine: data,
          insurancePerLineUsd: ins,
          yearsAsCustomer: years,
          customerName: name,
          accountNumber: acct,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Txt label="Carrier" value={carrier} onChange={setCarrier} />
        <Num label="Number of Lines" value={lines} onChange={setLines} />
        <Num label="Total Monthly Bill $" value={bill} onChange={setBill} />
        <Num label="Device Payments Included $/mo" value={devices} onChange={setDevices} />
        <Num label="Avg Data per Line (GB/mo)" value={data} onChange={setData} />
        <Num label="Device Protection $/line" value={ins} onChange={setIns} />
        <Num label="Years with Carrier" value={years} onChange={setYears} />
      </div>
      <LetterDetails>
        <Txt label="Your Name" value={name} onChange={setName} placeholder="Jordan Taylor" />
        <Txt label="Account #" value={acct} onChange={setAcct} placeholder="Account number" />
      </LetterDetails>
      <SubmitBtn loading={loading} label="Right-Size My Phone Plan (Free)" />
    </form>
  );
};

const ProtectDisputeForm: React.FC<FormProps> = ({ loading, onSubmit }) => {
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState(189);
  const [method, setMethod] = useState('credit');
  const [issue, setIssue] = useState('not_received');
  const [purchase, setPurchase] = useState(iso(24));
  const [statement, setStatement] = useState(iso(12));
  const [contacted, setContacted] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [order, setOrder] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          merchant,
          amountUsd: amount,
          paymentMethod: method,
          issueType: issue,
          purchaseDateIso: purchase,
          statementDateIso: statement,
          merchantContacted: contacted,
          cardIssuer: issuer,
          customerName: name,
          cardLast4: last4,
          orderNumber: order,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Txt label="Merchant" value={merchant} onChange={setMerchant} placeholder="e.g. Online furniture store" />
        <Num label="Charge Amount $" value={amount} onChange={setAmount} />
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Paid With
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            <option value="credit">Credit card</option>
            <option value="debit">Debit card</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          What Happened
          <select value={issue} onChange={(e) => setIssue(e.target.value)} className={inputCls}>
            <option value="not_received">Never received it</option>
            <option value="defective">Defective / damaged</option>
            <option value="not_as_described">Not as described</option>
            <option value="cancelled_still_charged">Cancelled, still charged</option>
            <option value="double_charged">Double / wrong amount</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Purchase Date
          <input type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
          Statement Date (showing charge)
          <input type="date" value={statement} onChange={(e) => setStatement(e.target.value)} className={inputCls} />
        </label>
        <label className="col-span-2 flex items-end gap-2 pb-3 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={contacted} onChange={(e) => setContacted(e.target.checked)} className="h-4 w-4 accent-[#059669]" />
          I already contacted the merchant
        </label>
      </div>
      <LetterDetails>
        <Txt label="Card Issuer / Bank" value={issuer} onChange={setIssuer} placeholder="Chase" />
        <Txt label="Your Name" value={name} onChange={setName} placeholder="Jordan Taylor" />
        <Txt label="Card Last 4" value={last4} onChange={setLast4} placeholder="4821" />
        <Txt label="Order / Confirmation #" value={order} onChange={setOrder} placeholder="#A10293" />
      </LetterDetails>
      <SubmitBtn loading={loading} label="Find My Dispute Deadline (Free)" />
    </form>
  );
};

interface SubRow {
  id: string;
  name: string;
  category: string;
  monthlyUsd: number;
  rarelyUsed: boolean;
  cancel: boolean;
}

const LifeSubscriptionsForm: React.FC<FormProps> = ({ loading, onSubmit }) => {
  const [rows, setRows] = useState<SubRow[]>([
    { id: '1', name: 'Netflix', category: 'streaming', monthlyUsd: 15.49, rarelyUsed: false, cancel: false },
    { id: '2', name: 'Hulu', category: 'streaming', monthlyUsd: 17.99, rarelyUsed: true, cancel: true },
    { id: '3', name: 'Max', category: 'streaming', monthlyUsd: 16.99, rarelyUsed: true, cancel: false },
    { id: '4', name: 'Spotify', category: 'music', monthlyUsd: 11.99, rarelyUsed: false, cancel: false },
    { id: '5', name: 'Gym membership', category: 'fitness', monthlyUsd: 39.99, rarelyUsed: true, cancel: true },
    { id: '6', name: 'Cloud storage', category: 'software', monthlyUsd: 9.99, rarelyUsed: false, cancel: false },
    { id: '7', name: 'Meal kit', category: 'food', monthlyUsd: 59.96, rarelyUsed: true, cancel: false },
  ]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const update = (id: string, patch: Partial<SubRow>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => s + r.monthlyUsd, 0);
  const cut = rows.filter((r) => r.cancel).reduce((s, r) => s + r.monthlyUsd, 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ items: rows, customerName: name, accountEmail: email });
      }}
      className="space-y-4"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between bg-[#F4F8FC] px-4 py-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Your Subscriptions</span>
          <span className="font-mono text-xs font-bold text-[#071930]">
            ${total.toFixed(2)}/mo • cutting <span className="text-[#059669]">${cut.toFixed(2)}/mo</span>
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className={`grid grid-cols-12 items-center gap-2 px-4 py-2.5 ${r.cancel ? 'bg-emerald-50/60' : 'bg-white'}`}>
              <input
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                className="col-span-5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-[#071930] hover:border-slate-300 focus:border-[#0B4F9C] focus:bg-white focus:outline-none sm:col-span-4"
              />
              <select
                value={r.category}
                onChange={(e) => update(r.id, { category: e.target.value })}
                className="col-span-3 hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 sm:block sm:col-span-2"
              >
                {['streaming', 'music', 'fitness', 'software', 'food', 'news', 'other'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="col-span-3 flex items-center gap-1 sm:col-span-2">
                <span className="text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={r.monthlyUsd}
                  onChange={(e) => update(r.id, { monthlyUsd: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-bold text-[#071930]"
                />
              </div>
              <label className="col-span-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={r.rarelyUsed} onChange={(e) => update(r.id, { rarelyUsed: e.target.checked })} className="accent-amber-500" />
                Rarely use
              </label>
              <label className="col-span-1 flex items-center gap-1.5 text-[11px] font-bold text-[#059669] sm:col-span-1">
                <input type="checkbox" checked={r.cancel} onChange={(e) => update(r.id, { cancel: e.target.checked })} className="accent-[#059669]" />
                <span className="hidden sm:inline">Cancel</span>
              </label>
              <button
                type="button"
                onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                className="col-span-1 justify-self-end text-slate-400 hover:text-rose-600"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="bg-white px-4 py-2.5">
          <button
            type="button"
            onClick={() =>
              setRows([...rows, { id: String(Date.now()), name: 'New subscription', category: 'other', monthlyUsd: 9.99, rarelyUsed: false, cancel: false }])
            }
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0B4F9C] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add subscription
          </button>
        </div>
      </div>
      <LetterDetails>
        <Txt label="Your Name" value={name} onChange={setName} placeholder="Jordan Taylor" />
        <Txt label="Account Email" value={email} onChange={setEmail} placeholder="you@email.com" />
      </LetterDetails>
      <SubmitBtn loading={loading} label="Calculate My Savings (Free)" />
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" /> We never log into your accounts — you send every request yourself.
      </p>
    </form>
  );
};
