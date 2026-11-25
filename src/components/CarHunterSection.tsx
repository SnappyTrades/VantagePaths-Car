import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface StateRule {
  code: string;
  name: string;
}

export interface HuntedListingForBoard {
  dealerName: string;
  sellingPrice: number;
  addOns: number;
  docFee: number;
  taxAndDmv: number;
  vehicleLabel: string;
  vin: string;
}

interface Props {
  states: StateRule[];
  homeState: string;
  onHomeStateChange: (code: string) => void;
  onAddToBidBoard: (item: HuntedListingForBoard) => void;
  onInspectVin: (vin: string) => void;
}

export const CarHunterSection: React.FC<Props> = ({
  states,
  homeState,
  onHomeStateChange,
  onAddToBidBoard,
  onInspectVin,
}) => {
  const [year, setYear] = useState('2026');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('RAV4');
  const [trim, setTrim] = useState('XLE Premium');
  const [color, setColor] = useState('Black');
  const [zip, setZip] = useState('75201');
  const [radiusMiles, setRadiusMiles] = useState(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  // Sniper Alert Capture
  const [alertEmail, setAlertEmail] = useState('');
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const runSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auto/search-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          make,
          model,
          trim,
          color,
          zip,
          radiusMiles,
          homeStateCode: homeState,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search inventory.');
    } finally {
      setLoading(false);
    }
  };

  const saveSniperAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: alertEmail,
        vertical: 'car-sniper',
        notes: `${color} ${year} ${make} ${model} ${trim} within ${radiusMiles}mi of ${zip}`,
      }),
    });
    const json = await res.json();
    setAlertMsg(json.message || 'Price-drop & exact-match alert saved!');
    setAlertEmail('');
  };

  return (
    <section className="rounded-2xl border-2 border-[#0F766E]/35 bg-white p-6 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
            <Flame className="h-3.5 w-3.5" /> Anti-Dealer Leverage Car Hunter • Zero Phone Spam
          </span>
          <h2 className="font-serif-display mt-1.5 text-2xl font-bold text-[#0B1528]">
            Find Your Exact Car &amp; Rank Dealers by Negotiation Leverage (Not Paid Ads)
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Instead of typing filters into 5 dealer-sponsored sites that sell your phone number, search once here. We generate pre-sorted <strong>Oldest-on-Lot</strong> links across Cars.com, CarGurus, AutoTrader &amp; TrueCar, estimate <strong>True Out-The-Door (OTD)</strong> price with state doc caps, and let you drop matches straight into your 5-Dealer Bid-War Board.
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={runSearch} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Field label="Year" value={year} onChange={setYear} placeholder="2026" />
        <Field label="Make" value={make} onChange={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChange={setModel} placeholder="RAV4" />
        <Field label="Trim" value={trim} onChange={setTrim} placeholder="XLE Premium" />
        <Field label="Color" value={color} onChange={setColor} placeholder="Black" />
        <Field label="ZIP Code" value={zip} onChange={setZip} placeholder="75201" />
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Radius
          <select
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-2.5 py-2 text-sm text-[#0B1528]"
          >
            <option value={50}>50 mi</option>
            <option value={100}>100 mi</option>
            <option value={250}>250 mi</option>
            <option value={500}>500 mi</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Your State
          <select
            value={homeState}
            onChange={(e) => onHomeStateChange(e.target.value)}
            className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-2.5 py-2 text-sm text-[#0B1528]"
          >
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 sm:col-span-4 lg:col-span-8">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#115E59] disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading
              ? 'Hunting Matches & Computing Buyer Leverage...'
              : `Hunt ${color} ${year} ${make} ${model} ${trim} Near ${zip} (Free & Zero Spam)`}
          </button>
        </div>
      </form>

      {error && <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}

      {data && (
        <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
          {/* 1-Click Multi-Site Deep-Filter Launcher */}
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B1528]">
                1-Click Pre-Filtered Searches for "{data.querySummary}" Near {zip}
              </span>
              <span className="font-mono text-[11px] font-semibold text-[#0F766E]">
                Zero re-typing • Pre-sorted for longest lot time
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.deepLinks.map((lnk: any, idx: number) => (
                <a
                  key={idx}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-slate-200 bg-[#FAF9F5] p-3.5 transition hover:border-[#0F766E] hover:bg-teal-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#0B1528] group-hover:text-[#0F766E]">
                      {lnk.site}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0F766E]" />
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-[#0F766E] border border-teal-200">
                    {lnk.badge}
                  </span>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{lnk.description}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Leverage-Ranked Inventory Cards */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#0B1528]">
                  Ranked by Buyer Negotiation Leverage (Est. True OTD Included)
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                    data.mode === 'PREVIEW_PLUS_DEEP_LINKS'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {data.mode === 'PREVIEW_PLUS_DEEP_LINKS'
                    ? 'INTERACTIVE PREVIEW'
                    : data.cached
                    ? `${data.mode} (CACHED)`
                    : data.mode}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Click "+ Add to Bid-War" to push directly into Step 3 below
              </span>
            </div>

            {data.apiSetupHint && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[11.5px] text-amber-950">
                <strong className="font-bold">Live Inventory API Ready: </strong>
                {data.apiSetupHint}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {data.listings.map((car: any) => {
                const isAdded = Boolean(addedIds[car.id]);
                return (
                  <div
                    key={car.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 transition hover:border-[#0F766E]"
                  >
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-[#0B1528]">
                            {car.exteriorColor} {car.year} {car.make} {car.model} {car.trim}
                          </div>
                          <div className="text-xs text-slate-600">
                            {car.dealerName} • {car.dealerCity}, {car.dealerState}
                            {car.distanceMiles != null ? ` (${car.distanceMiles} mi)` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-extrabold ${
                              car.leverageLabel === 'HIGH LEVERAGE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : car.leverageLabel === 'MODERATE LEVERAGE'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {car.leverageScore}/100 • {car.leverageLabel}
                          </span>
                          <div className="mt-0.5 font-mono text-[10.5px] text-slate-500">
                            {car.daysOnMarket}d on lot
                            {car.priceDropCount > 0 ? ` • ${car.priceDropCount} drop(s)` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">Listed Price</div>
                          <div className="font-mono text-sm font-bold text-[#0B1528]">
                            ${car.advertisedPriceUsd.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">Est. Doc Fee</div>
                          <div className="font-mono text-sm font-bold text-slate-700">
                            ${car.estimatedDocFeeUsd.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded bg-teal-50/80 py-0.5">
                          <div className="text-[10px] font-bold uppercase text-[#0F766E]">Est. True OTD</div>
                          <div className="font-mono text-sm font-extrabold text-[#0F766E]">
                            ${car.estimatedTrueOtdUsd.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                        <strong className="text-[#0B1528]">Leverage Signal:</strong> {car.leverageReason}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                      <span className="font-mono text-[10.5px] text-slate-500">VIN: {car.vin}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInspectVin(car.vin)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#0B1528] hover:border-[#0F766E]"
                        >
                          Check NHTSA Recalls
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddToBidBoard({
                              dealerName: car.dealerName,
                              sellingPrice: car.advertisedPriceUsd,
                              addOns: 0,
                              docFee: car.estimatedDocFeeUsd,
                              taxAndDmv: car.estimatedTaxAndDmvUsd,
                              vehicleLabel: `${car.exteriorColor} ${car.year} ${car.make} ${car.model} ${car.trim}`,
                              vin: car.vin,
                            });
                            setAddedIds((prev) => ({ ...prev, [car.id]: true }));
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                            isAdded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#0B1528] text-white hover:bg-[#0F766E]'
                          }`}
                        >
                          {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {isAdded ? 'Added to Bid Board' : 'Add to Bid-War'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exact-Match & Price-Drop Sniper Alert */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex items-start gap-2.5">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
                <div>
                  <div className="text-xs font-extrabold text-[#0B1528]">
                    Want a Price-Drop &amp; Exact-Match Alert for "{data.querySummary}" Near {zip}?
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Stop refreshing 5 sites every morning — save your exact trim/color alert here with zero dealer spam.
                  </div>
                </div>
              </div>
              <form onSubmit={saveSniperAlert} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs text-[#0B1528]"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-[#0B1528] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0F766E]"
                >
                  Save Alert
                </button>
              </form>
            </div>
            {alertMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                <CheckCircle2 className="h-3.5 w-3.5" /> {alertMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Field: React.FC<{
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
      className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-2.5 py-2 text-sm text-[#0B1528] focus:border-[#0F766E] focus:bg-white focus:outline-none"
    />
  </label>
);
