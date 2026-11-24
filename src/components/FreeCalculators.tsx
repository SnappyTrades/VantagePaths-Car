import React, { useState } from 'react';
import { Calculator, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import type { AuditVerticalId } from '../shared/types';

interface Props {
  vertical: AuditVerticalId;
}

export const FreeCalculators: React.FC<Props> = ({ vertical }) => {
  if (vertical === 'freight') return <FreightCalculator />;
  if (vertical === 'auto') return <AutoCalculator />;
  return <HomeBidCalculator />;
};

const FreightCalculator: React.FC = () => {
  const [loadedMiles, setLoadedMiles] = useState(925);
  const [deadheadMiles, setDeadheadMiles] = useState(65);
  const [mpg, setMpg] = useState(6.5);
  const [dieselPerGallon, setDieselPerGallon] = useState(3.79);
  const [driverPayPerMile, setDriverPayPerMile] = useState(0.68);
  const [otherCostsUsd, setOtherCostsUsd] = useState(145);
  const [offeredRateUsd, setOfferedRateUsd] = useState(2650);
  const [quotedFscPct, setQuotedFscPct] = useState(38);
  const [result, setResult] = useState<any>(null);

  const [dotNumber, setDotNumber] = useState('');
  const [fmcsaResult, setFmcsaResult] = useState<any>(null);
  const [fmcsaLoading, setFmcsaLoading] = useState(false);

  const runCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/calculators/freight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loadedMiles,
        deadheadMiles,
        mpg,
        dieselPerGallon,
        driverPayPerMile,
        otherCostsUsd,
        offeredRateUsd,
        quotedFscPct,
      }),
    });
    setResult(await res.json());
  };

  const runFmcsa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dotNumber.trim()) return;
    setFmcsaLoading(true);
    try {
      const res = await fetch(`/api/calculators/fmcsa/${encodeURIComponent(dotNumber.trim())}`);
      setFmcsaResult(await res.json());
    } finally {
      setFmcsaLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Calculator className="h-3.5 w-3.5" /> Free Freight Profit & FSC Tool
          </span>
          <h3 className="mt-1 text-lg font-bold text-white">
            Load Cost-Per-Mile & Fuel Surcharge Calculator
          </h3>
        </div>
      </div>

      <form onSubmit={runCalc} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Loaded Miles" value={loadedMiles} onChange={setLoadedMiles} />
        <Field label="Deadhead Miles" value={deadheadMiles} onChange={setDeadheadMiles} />
        <Field label="Truck MPG" value={mpg} step="0.1" onChange={setMpg} />
        <Field label="Diesel ($/gal)" value={dieselPerGallon} step="0.01" onChange={setDieselPerGallon} />
        <Field label="Driver Pay ($/mi)" value={driverPayPerMile} step="0.01" onChange={setDriverPayPerMile} />
        <Field label="Tolls/Ins/Maint ($)" value={otherCostsUsd} onChange={setOtherCostsUsd} />
        <Field label="Offered Rate ($)" value={offeredRateUsd} onChange={setOfferedRateUsd} />
        <Field label="Billed FSC (%)" value={quotedFscPct} step="0.5" onChange={setQuotedFscPct} />
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Calculate True Profit & Minimum Counter-Offer
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-4">
          <Metric label="Net Load Profit" value={`$${result.netProfitUsd.toLocaleString()}`} accent={result.netProfitUsd > 0 ? 'text-emerald-400' : 'text-rose-400'} />
          <Metric label="All-In RPM vs Cost/Mi" value={`$${result.allInRpm} / $${result.costPerMile}`} />
          <Metric label="Min Counter-Offer (18%)" value={`$${result.minProfitableRateUsd.toLocaleString()}`} accent="text-sky-400" />
          <Metric label="FSC Overcharge Flag" value={result.fscOverchargeUsd > 0 ? `+$${result.fscOverchargeUsd}` : 'Within EIA'} accent={result.fscOverchargeUsd > 0 ? 'text-amber-400' : 'text-emerald-400'} />
        </div>
      )}

      <form onSubmit={runFmcsa} className="mt-5 flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row">
        <input
          type="text"
          value={dotNumber}
          onChange={(e) => setDotNumber(e.target.value)}
          placeholder="Optional: Verify Carrier USDOT or MC# (FMCSA SAFER)"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={fmcsaLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          <Search className="h-4 w-4" /> {fmcsaLoading ? 'Checking...' : 'Check Carrier'}
        </button>
      </form>
      {fmcsaResult && (
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-300">
          {fmcsaResult.legalName ? (
            <span>
              <strong className="text-emerald-400">{fmcsaResult.legalName}</strong> — Allowed to Operate:{' '}
              {fmcsaResult.allowedToOperate} | Safety Rating: {fmcsaResult.safetyRating}
            </span>
          ) : (
            <span>{fmcsaResult.message}</span>
          )}
        </div>
      )}
    </div>
  );
};

const AutoCalculator: React.FC = () => {
  const [sellingPriceUsd, setSellingPriceUsd] = useState(36485);
  const [dealerAddOnsUsd, setDealerAddOnsUsd] = useState(2789);
  const [docFeeUsd, setDocFeeUsd] = useState(995);
  const [stateDocFeeCapUsd, setStateDocFeeCapUsd] = useState(175);
  const [taxRatePct, setTaxRatePct] = useState(7.5);
  const [downPaymentUsd, setDownPaymentUsd] = useState(4000);
  const [quotedAprPct, setQuotedAprPct] = useState(8.89);
  const [benchmarkAprPct, setBenchmarkAprPct] = useState(5.79);
  const [termMonths, setTermMonths] = useState(72);
  const [leaseMoneyFactor, setLeaseMoneyFactor] = useState(0);
  const [result, setResult] = useState<any>(null);

  const runCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/calculators/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellingPriceUsd,
        dealerAddOnsUsd,
        docFeeUsd,
        stateDocFeeCapUsd,
        taxRatePct,
        titleRegUsd: 350,
        downPaymentUsd,
        quotedAprPct,
        benchmarkAprPct,
        termMonths,
        leaseMoneyFactor: leaseMoneyFactor > 0 ? leaseMoneyFactor : undefined,
      }),
    });
    setResult(await res.json());
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
        <Calculator className="h-3.5 w-3.5" /> Free Auto Buyer Calculator
      </span>
      <h3 className="mt-1 mb-4 text-lg font-bold text-white">
        True Out-The-Door (OTD), Junk-Fee & APR Markup Calculator
      </h3>

      <form onSubmit={runCalc} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Selling Price ($)" value={sellingPriceUsd} onChange={setSellingPriceUsd} />
        <Field label="Dealer Add-Ons ($)" value={dealerAddOnsUsd} onChange={setDealerAddOnsUsd} />
        <Field label="Quoted Doc Fee ($)" value={docFeeUsd} onChange={setDocFeeUsd} />
        <Field label="State Doc Cap ($)" value={stateDocFeeCapUsd} onChange={setStateDocFeeCapUsd} />
        <Field label="Sales Tax (%)" value={taxRatePct} step="0.1" onChange={setTaxRatePct} />
        <Field label="Down Payment ($)" value={downPaymentUsd} onChange={setDownPaymentUsd} />
        <Field label="Dealer APR (%)" value={quotedAprPct} step="0.05" onChange={setQuotedAprPct} />
        <Field label="Fair Prime APR (%)" value={benchmarkAprPct} step="0.05" onChange={setBenchmarkAprPct} />
        <Field label="Term (Months)" value={termMonths} onChange={setTermMonths} />
        <Field label="Lease MF (opt)" value={leaseMoneyFactor} step="0.0001" onChange={setLeaseMoneyFactor} />
        <div className="col-span-2 sm:col-span-5">
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Calculate Hidden Dealer Markup & Fair OTD
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-4">
          <Metric label="Quoted vs Clean OTD" value={`$${result.quotedOtdUsd.toLocaleString()} → $${result.fairOtdUsd.toLocaleString()}`} />
          <Metric label="APR Markup Cost" value={`+$${result.aprMarkupInterestUsd.toLocaleString()}`} accent="text-rose-400" />
          <Metric label="Monthly Payment Savings" value={`$${result.monthlySavingsUsd}/mo`} accent="text-emerald-400" />
          <Metric
            label={result.equivalentLeaseAprPct ? 'Lease Equiv APR / Total Save' : 'Total Deal Savings'}
            value={
              result.equivalentLeaseAprPct
                ? `${result.equivalentLeaseAprPct}% / $${result.totalDealSavingsUsd.toLocaleString()}`
                : `$${result.totalDealSavingsUsd.toLocaleString()}`
            }
            accent="text-emerald-400"
          />
        </div>
      )}
    </div>
  );
};

const HomeBidCalculator: React.FC = () => {
  const [projectType, setProjectType] = useState<'roof' | 'hvac' | 'solar' | 'remodel' | 'insurance-claim'>('roof');
  const [squareFeet, setSquareFeet] = useState(2400);
  const [quotedUsd, setQuotedUsd] = useState(28950);
  const [regionTier, setRegionTier] = useState<'low' | 'standard' | 'high'>('standard');
  const [result, setResult] = useState<any>(null);

  const runCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/calculators/home-bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectType, squareFeet, quotedUsd, regionTier }),
    });
    setResult(await res.json());
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <Calculator className="h-3.5 w-3.5" /> Free Home Bid & Claim Benchmark Tool
      </span>
      <h3 className="mt-1 mb-4 text-lg font-bold text-white">
        Contractor Fair Price Estimator & Mandatory IRC Code Checklist
      </h3>

      <form onSubmit={runCalc} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Project Type
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as any)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="roof">Roof Replacement (sq ft)</option>
            <option value="hvac">HVAC Full System (home sq ft)</option>
            <option value="solar">Solar System (watts / sq ft eq.)</option>
            <option value="remodel">Kitchen / Bath Remodel (sq ft)</option>
            <option value="insurance-claim">Storm Insurance Claim (sq ft)</option>
          </select>
        </label>
        <Field label="Area / Size (sq ft)" value={squareFeet} onChange={setSquareFeet} />
        <Field label="Quoted Bid / Claim ($)" value={quotedUsd} onChange={setQuotedUsd} />
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Regional Labor Tier
          <select
            value={regionTier}
            onChange={(e) => setRegionTier(e.target.value as any)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="low">Lower-Cost Metro / Rural</option>
            <option value="standard">US Standard Metro</option>
            <option value="high">High-Cost Coastal / Major Metro</option>
          </select>
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Check Fair Regional Range & Missing Code Items
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Fair Regional Range" value={`$${result.fairLowUsd.toLocaleString()} – $${result.fairHighUsd.toLocaleString()}`} accent="text-emerald-400" />
            <Metric
              label="Variance vs Fair High"
              value={result.varianceFromHighUsd > 0 ? `+$${result.varianceFromHighUsd.toLocaleString()} Above High` : 'Within Range'}
              accent={result.varianceFromHighUsd > 0 ? 'text-rose-400' : 'text-emerald-400'}
            />
            <Metric label="Status" value={result.verdict.replace('_', ' ')} accent={result.verdict === 'WITHIN_RANGE' ? 'text-emerald-400' : 'text-amber-400'} />
          </div>
          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Verify These Items Are Explicitly In Your Bid:
            </p>
            <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-300 sm:grid-cols-2">
              {result.mandatoryChecklist.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{
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
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
    />
  </label>
);

const Metric: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent = 'text-white',
}) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-bold ${accent}`}>{value}</div>
  </div>
);
