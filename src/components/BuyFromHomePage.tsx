import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import type { PublicAuditResponse } from '../shared/types';
import { AuditWorkspace } from './AuditWorkspace';
import { CarHunterSection } from './CarHunterSection';
import { LockedGeneratorCard } from './LockedGeneratorCard';
import { PartnerCard } from './PartnerCard';

interface StateRule {
  code: string;
  name: string;
  docFeeCapUsd: number | null;
  typicalDocFeeUsd: number;
  tradeInTaxCredit: boolean;
  typicalSalesTaxPct: number;
  notes: string;
}

interface DealerQuoteRow {
  id: string;
  dealerName: string;
  sellingPrice: number;
  addOns: number;
  docFee: number;
  taxAndDmv: number;
}

interface Props {
  states: StateRule[];
  initialAudit?: PublicAuditResponse | null;
}

export const BuyFromHomePage: React.FC<Props> = ({ states, initialAudit = null }) => {
  // 1. Live Free NHTSA VIN Lookup
  const [vinInput, setVinInput] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinData, setVinData] = useState<any>(null);

  // 2. Multi-Dealer Blind Email Bid-War + Side-by-Side Comparison Board
  const [homeState, setHomeState] = useState('TX');
  const [targetVehicle, setTargetVehicle] = useState('2026 Toyota RAV4 Hybrid XLE AWD');
  const [zipCode, setZipCode] = useState('75024');
  const [bidWarKit, setBidWarKit] = useState<PublicAuditResponse | null>(
    initialAudit && initialAudit.auditId.startsWith('vp_autobid_') ? initialAudit : null
  );
  const [generatingBidKit, setGeneratingBidKit] = useState(false);

  const [quotes, setQuotes] = useState<DealerQuoteRow[]>([
    { id: '1', dealerName: 'Local Dealer A (Suncrest)', sellingPrice: 37985, addOns: 2789, docFee: 995, taxAndDmv: 2980 },
    { id: '2', dealerName: 'Metro Dealer B (Northside)', sellingPrice: 36485, addOns: 699, docFee: 225, taxAndDmv: 2660 },
    { id: '3', dealerName: 'Out-of-Area Dealer C (Volume)', sellingPrice: 35600, addOns: 0, docFee: 225, taxAndDmv: 2560 },
  ]);

  // 3. Out-of-State Buying Math
  const [remoteState, setRemoteState] = useState('OH');
  const [oosLocalPrice, setOosLocalPrice] = useState(37985);
  const [oosLocalAddOns, setOosLocalAddOns] = useState(2195);
  const [oosRemotePrice, setOosRemotePrice] = useState(35600);
  const [oosShipping, setOosShipping] = useState(750);
  const [oosResult, setOosResult] = useState<any>(null);

  // 4. 4-Square BS-Detector
  const [fsPrice, setFsPrice] = useState(36500);
  const [fsDown, setFsDown] = useState(4000);
  const [fsTax, setFsTax] = useState(7.25);
  const [fsTerm, setFsTerm] = useState(72);
  const [fsMonthly, setFsMonthly] = useState(689);
  const [fsApr, setFsApr] = useState(5.9);
  const [fsResult, setFsResult] = useState<any>(null);

  const activeStateRule = useMemo(
    () => states.find((s) => s.code === homeState) ?? null,
    [states, homeState]
  );

  const lookupVin = async (customVin?: string) => {
    const v = (customVin ?? vinInput).trim();
    if (!v) return;
    setVinError(null);
    setVinLoading(true);
    try {
      const res = await fetch(`/api/auto/vin/${encodeURIComponent(v)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'VIN lookup failed.');
      setVinData(data);
      setTargetVehicle(`${data.year} ${data.make} ${data.model} ${data.trim}`.trim());
    } catch (err) {
      setVinError(err instanceof Error ? err.message : 'Unable to decode VIN.');
    } finally {
      setVinLoading(false);
    }
  };

  const rankedQuotes = useMemo(() => {
    return quotes
      .map((q) => {
        const quotedOtd = q.sellingPrice + q.addOns + q.docFee + q.taxAndDmv;
        const cleanOtd = q.sellingPrice + Math.min(q.docFee, activeStateRule?.docFeeCapUsd ?? 250) + q.taxAndDmv;
        return { ...q, quotedOtd, cleanOtd };
      })
      .sort((a, b) => a.quotedOtd - b.quotedOtd);
  }, [quotes, activeStateRule]);

  const bestQuote = rankedQuotes[0];
  const worstQuote = rankedQuotes[rankedQuotes.length - 1];

  const generateBidWarEmails = async () => {
    setGeneratingBidKit(true);
    try {
      const res = await fetch('/api/auto/bidwar-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVehicle,
          zipCode,
          homeState,
          bestDealerName: bestQuote?.dealerName || 'Competing Metro Dealer',
          bestOtdUsd: bestQuote?.quotedOtd || 38385,
          highestOtdUsd: worstQuote?.quotedOtd || 43500,
        }),
      });
      const data = await res.json();
      if (res.ok && data.kit) setBidWarKit(data.kit);
    } finally {
      setGeneratingBidKit(false);
    }
  };

  const runOos = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auto/out-of-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeStateCode: homeState,
        remoteStateCode: remoteState,
        localDealerPriceUsd: oosLocalPrice,
        localAddOnsUsd: oosLocalAddOns,
        remoteDealerPriceUsd: oosRemotePrice,
        shippingOrFlightCostUsd: oosShipping,
      }),
    });
    setOosResult(await res.json());
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
        titleRegDocUsd: (activeStateRule?.docFeeCapUsd ?? 250) + 325,
        termMonths: fsTerm,
        dealerQuotedMonthlyUsd: fsMonthly,
        expectedFairAprPct: fsApr,
      }),
    });
    setFsResult(await res.json());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
          Pillar 1 • Couch-to-Keys Deal Room
        </span>
        <h1 className="font-serif-display text-3xl font-bold text-[#0B1528] sm:text-4xl">
          Buy Your Next Car 95% From Home — Without Stepping Into a Dealership Blind
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Dealers win by mixing car price, trade-in, financing, and add-ons at one desk under time pressure. Follow this 5-step remote workflow to decode the VIN, lock in outside financing, run a zero-spam 5-dealer email bid-war, and audit the final contract PDF from your couch.
        </p>
      </div>

      {/* ANTI-DEALER LEVERAGE CAR HUNTER */}
      <CarHunterSection
        states={states}
        homeState={homeState}
        onHomeStateChange={setHomeState}
        onAddToBidBoard={(item) => {
          setTargetVehicle(item.vehicleLabel);
          setQuotes((prev) => [
            ...prev,
            {
              id: `hunted_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              dealerName: item.dealerName,
              sellingPrice: item.sellingPrice,
              addOns: item.addOns,
              docFee: item.docFee,
              taxAndDmv: item.taxAndDmv,
            },
          ]);
        }}
        onInspectVin={(vin) => {
          setVinInput(vin);
          lookupVin(vin);
          document.getElementById('vin-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      {/* STEP 1: FREE LIVE NHTSA VIN DECODER + RECALLS & OWNER COMPLAINTS */}
      <section id="vin-section" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              Step 1 • Free Official US Gov NHTSA Check
            </span>
            <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
              Paste Any 17-Digit VIN for Instant Recalls &amp; Owner Defect Leverage
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const sample = '2T3P1RFV0RW441234';
              setVinInput(sample);
              lookupVin(sample);
            }}
            className="rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-bold text-[#0F766E] hover:bg-teal-100"
          >
            Try Sample RAV4 Hybrid VIN
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              maxLength={17}
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              placeholder="Enter 17-character VIN from dealer listing, Cars.com, or your registration..."
              className="w-full rounded-xl border border-slate-300 bg-[#FAF9F5] py-2.5 pl-10 pr-4 font-mono text-sm text-[#0B1528] focus:border-[#0F766E] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={vinLoading}
            onClick={() => lookupVin()}
            className="rounded-xl bg-[#0B1528] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F766E] disabled:opacity-50"
          >
            {vinLoading ? 'Querying NHTSA...' : 'Decode VIN & Check Recalls Free'}
          </button>
        </div>

        {vinError && <p className="mt-2 text-xs font-semibold text-rose-700">{vinError}</p>}

        {vinData && (
          <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-[#FAF9F5] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  VIN: {vinData.vin} • Source: {vinData.source === 'NHTSA_LIVE' ? 'Live US Gov NHTSA API' : 'Offline Preview'}
                </div>
                <h3 className="mt-0.5 text-lg font-extrabold text-[#0B1528]">
                  {vinData.year} {vinData.make} {vinData.model} ({vinData.trim})
                </h3>
                <div className="text-xs text-slate-600">
                  {vinData.bodyClass} • {vinData.engineSummary} • {vinData.fuelType} • Built in {vinData.plantCountry}
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`rounded-xl px-3 py-2 font-mono text-xs font-bold ${vinData.recallCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {vinData.recallCount} Recall(s)
                </span>
                <span className="rounded-xl bg-amber-100 px-3 py-2 font-mono text-xs font-bold text-amber-900">
                  {vinData.complaintCount} Owner Complaints
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-teal-200 bg-white p-3.5 text-xs font-medium leading-relaxed text-[#0B1528]">
              <strong className="text-[#0F766E]">Negotiation Leverage: </strong>
              {vinData.negotiationInsight}
            </div>

            {vinData.recalls.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {vinData.recalls.slice(0, 2).map((r: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs">
                    <div className="font-bold text-rose-900">
                      Recall {r.campaignNumber}: {r.component}
                    </div>
                    <p className="mt-1 text-slate-700">{r.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* STEP 2: DECOUPLE FINANCING & REMOTE USED-CAR INSPECTION (DAY-1 AFFILIATE LAYER!) */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
            Step 2 • Zero-Spam Shield &amp; Outside Financing First
          </span>
          <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
            Never Give a Dealership Your Real Phone Number or Let Them Control Your APR
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <TipBox
              num="1"
              title="Use a Free Google Voice / Email Buffer"
              body="Dealership CRMs share your cell phone across dozens of reps. Create a dedicated shopping email and state 'Email only until written OTD is agreed.'"
            />
            <TipBox
              num="2"
              title="Lock In Outside Pre-Approval First"
              body="Holding a real credit union or online APR before emailing dealers removes 100% of their F&I interest-rate markup power — dealers have to beat it."
            />
            <TipBox
              num="3"
              title="Target 60+ Day Old Inventory"
              body="Sort Cars.com or CarGurus by 'Oldest Listings First.' Dealers pay daily floorplan interest on cars sitting 60+ days and discount them far harder."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PartnerCard
            partnerId="auto-preapproval"
            badge="Step 2A • Outside Financing"
            title="Get an Independent Auto Loan Pre-Approval Before Contacting Dealers"
            subtitle="Hold a competing APR in your pocket so the finance desk cannot silently pad your interest rate by 2%–3%."
            ctaLabel="Compare Pre-Approval APRs"
            source="buy_step2"
          />
          <PartnerCard
            partnerId="mobile-ppi"
            badge="Step 2B • Remote Used Cars"
            title="Buying a Used Car Remotely? Send a Mobile ASE Mechanic First"
            subtitle="Don't fly or ship blind — order an independent mobile inspection (~$200) for 60+ photos, OBD scan & road test at the seller's lot."
            ctaLabel="Check Mobile PPI Options"
            source="buy_step2_ppi"
            accent="amber"
          />
        </div>
      </section>

      {/* STEP 3: 5-DEALER BLIND EMAIL BID-WAR + MULTI-DEALER COMPARISON BOARD */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              Step 3 • Remote 5-Dealer Bid-War Board
            </span>
            <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
              Pit 5 Internet Sales Managers Against Each Other From Your Couch
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
              className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-xs font-bold text-[#0B1528]"
            >
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  State: {s.name} ({s.code})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="ZIP"
              className="w-24 rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 font-mono text-xs text-[#0B1528]"
            />
          </div>
        </div>

        {activeStateRule && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-xs text-teal-950">
            <strong>{activeStateRule.name} Statutory Benchmark:</strong> Doc Fee Cap ={' '}
            <span className="font-mono font-bold">
              {activeStateRule.docFeeCapUsd !== null
                ? `$${activeStateRule.docFeeCapUsd} Max`
                : `Uncapped (~$${activeStateRule.typicalDocFeeUsd} avg — negotiate selling price down!)`}
            </span>{' '}
            • Est. Tax ~{activeStateRule.typicalSalesTaxPct}% • {activeStateRule.notes}
          </div>
        )}

        {/* Side-by-Side Dealer Board */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#FAF9F5] px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Live Multi-Dealer Quote Comparison (Edit Numbers as Replies Arrive)
            </span>
            <button
              type="button"
              onClick={() =>
                setQuotes([
                  ...quotes,
                  {
                    id: String(Date.now()),
                    dealerName: `Dealer ${String.fromCharCode(65 + quotes.length)}`,
                    sellingPrice: 36500,
                    addOns: 0,
                    docFee: activeStateRule?.docFeeCapUsd ?? 250,
                    taxAndDmv: 2600,
                  },
                ])
              }
              className="inline-flex items-center gap-1 rounded-lg bg-[#0B1528] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0F766E]"
            >
              <Plus className="h-3 w-3" /> Add Dealer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Dealer</th>
                  <th className="px-3 py-2.5">Selling Price</th>
                  <th className="px-3 py-2.5">Add-Ons</th>
                  <th className="px-3 py-2.5">Doc Fee</th>
                  <th className="px-3 py-2.5">Tax &amp; DMV</th>
                  <th className="px-3 py-2.5">True OTD</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankedQuotes.map((q, idx) => (
                  <tr key={q.id} className={idx === 0 ? 'bg-emerald-50/60' : ''}>
                    <td className="px-3 py-2 font-bold text-[#0B1528]">
                      <input
                        value={q.dealerName}
                        onChange={(e) =>
                          setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, dealerName: e.target.value } : x)))
                        }
                        className="w-44 rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-slate-300 focus:border-[#0F766E] focus:bg-white focus:outline-none"
                      />
                      {idx === 0 && (
                        <span className="ml-1 rounded-full bg-[#0F766E] px-2 py-0.5 text-[9.5px] font-bold text-white">
                          BEST OTD
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <CellNum
                        val={q.sellingPrice}
                        onChange={(v) =>
                          setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, sellingPrice: v } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CellNum
                        val={q.addOns}
                        warn={q.addOns > 0}
                        onChange={(v) =>
                          setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, addOns: v } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CellNum
                        val={q.docFee}
                        warn={Boolean(activeStateRule?.docFeeCapUsd && q.docFee > activeStateRule.docFeeCapUsd)}
                        onChange={(v) =>
                          setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, docFee: v } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CellNum
                        val={q.taxAndDmv}
                        onChange={(v) =>
                          setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, taxAndDmv: v } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-sm font-extrabold text-[#0B1528]">
                      ${q.quotedOtd.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {quotes.length > 1 && (
                        <button
                          onClick={() => setQuotes(quotes.filter((x) => x.id !== q.id))}
                          className="text-slate-400 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Server-Paywalled Round 1 & Round 2 Bid-War Email Generator */}
        {!bidWarKit ? (
          <button
            type="button"
            disabled={generatingBidKit}
            onClick={generateBidWarEmails}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#05A66B] px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-[#048A58] disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {generatingBidKit
              ? 'Generating Custom Bid-War Emails...'
              : `Generate My Round 1 & Round 2 Bid-War Emails for "${targetVehicle}"`}
          </button>
        ) : (
          <LockedGeneratorCard
            kit={bidWarKit}
            onKitUpdated={setBidWarKit}
            headline={`Unlock Your Custom 5-Dealer Bid-War Emails & Express-Pickup Script`}
            subheadline={`Built for ${targetVehicle} in ${homeState} (ZIP ${zipCode}) — pits competing Internet Sales Managers against ${
              bestQuote?.dealerName || 'your lowest quote'
            } ($${(bestQuote?.quotedOtd || 38385).toLocaleString()} OTD).`}
            bullets={[
              `Round 1: 5-Dealer Blind OTD Solicitation Email (auto-cites ${homeState} doc fee rules)`,
              `Round 2: "Undercut $${(bestQuote?.quotedOtd || 38385).toLocaleString()} by $500 Today" Closing Counter-Email`,
              'Pre-Delivery Final TILA Contract Request & 15-Minute Express Pickup Script + Branded PDF',
            ]}
          />
        )}
      </section>

      {/* STEP 4: OUT-OF-STATE BUYING + 4-SQUARE BS-DETECTOR */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Out of State Math */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[#0F766E]">
            <Truck className="h-3.5 w-3.5" /> Out-of-State Buying Hack
          </span>
          <h3 className="font-serif-display mt-1 text-xl font-bold text-[#0B1528]">
            Does Buying 200+ Miles Away &amp; Shipping Save You Money?
          </h3>
          <form onSubmit={runOos} className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Remote Dealer State
              <select
                value={remoteState}
                onChange={(e) => setRemoteState(e.target.value)}
                className="rounded-xl border border-slate-300 bg-[#FAF9F5] px-3 py-2 text-sm text-[#0B1528]"
              >
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <InputNum label="Local Price ($)" value={oosLocalPrice} onChange={setOosLocalPrice} />
            <InputNum label="Local Add-Ons ($)" value={oosLocalAddOns} onChange={setOosLocalAddOns} />
            <InputNum label="Remote Clean Price ($)" value={oosRemotePrice} onChange={setOosRemotePrice} />
            <InputNum label="Shipping / Flight ($)" value={oosShipping} onChange={setOosShipping} />
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#115E59]"
              >
                Calculate Net Savings
              </button>
            </div>
          </form>
          {oosResult && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs">
              <div className="font-mono text-base font-extrabold text-[#0B1528]">
                {oosResult.netSavingsUsd > 0
                  ? `Remote Buy Wins by $${oosResult.netSavingsUsd.toLocaleString()}!`
                  : `Local Buy Wins by $${Math.abs(oosResult.netSavingsUsd).toLocaleString()}`}
              </div>
              <p className="mt-1 text-slate-700">{oosResult.taxRuleExplanation}</p>
            </div>
          )}
        </div>

        {/* 4-Square BS-Detector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-rose-700">
            <ShieldAlert className="h-3.5 w-3.5" /> 4-Square BS-Detector
          </span>
          <h3 className="font-serif-display mt-1 text-xl font-bold text-[#0B1528]">
            Dealer Only Gave a Monthly Payment? Expose Hidden Packing
          </h3>
          <form onSubmit={runFourSquare} className="mt-4 grid grid-cols-2 gap-3">
            <InputNum label="Car Price ($)" value={fsPrice} onChange={setFsPrice} />
            <InputNum label="Down / Trade ($)" value={fsDown} onChange={setFsDown} />
            <InputNum label="Sales Tax (%)" value={fsTax} step="0.1" onChange={setFsTax} />
            <InputNum label="Term (mos)" value={fsTerm} onChange={setFsTerm} />
            <InputNum label="Dealer Payment ($/mo)" value={fsMonthly} onChange={setFsMonthly} />
            <InputNum label="Fair Prime APR (%)" value={fsApr} step="0.1" onChange={setFsApr} />
            <div className="col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-[#0B1528] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0F766E]"
              >
                Reverse-Engineer Dealer Payment
              </button>
            </div>
          </form>
          {fsResult && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs">
              <div className="font-mono text-base font-extrabold text-rose-800">
                Hidden Markup: ~${fsResult.hiddenMarkupEstimateUsd.toLocaleString()} (or {fsResult.impliedAprAtFairPricePct}% APR)
              </div>
              <p className="mt-1 text-rose-900">{fsResult.explanation}</p>
            </div>
          )}
        </div>
      </section>

      {/* STEP 5: PRE-DELIVERY BUYER'S ORDER / FINAL CONTRACT AUDITOR */}
      <section className="space-y-3">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
            Step 5 • Final Verification Before e-Sign or 15-Minute Express Pickup
          </span>
          <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#0B1528]">
            Demand the Final Buyer's Order PDF at Home — Audit It Here First
          </h2>
        </div>
        <AuditWorkspace vertical="auto" initialAudit={initialAudit} />
      </section>
    </div>
  );
};

const TipBox: React.FC<{ num: string; title: string; body: string }> = ({ num, title, body }) => (
  <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4">
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0F766E] font-mono text-xs font-bold text-white">
      {num}
    </span>
    <h3 className="mt-2.5 text-sm font-extrabold text-[#0B1528]">{title}</h3>
    <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
  </div>
);

const CellNum: React.FC<{ val: number; warn?: boolean; onChange: (v: number) => void }> = ({
  val,
  warn = false,
  onChange,
}) => (
  <input
    type="number"
    value={val}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className={`w-24 rounded-lg border px-2 py-1 font-mono text-xs font-bold focus:outline-none ${
      warn
        ? 'border-rose-300 bg-rose-50 text-rose-800'
        : 'border-slate-200 bg-white text-[#0B1528] focus:border-[#0F766E]'
    }`}
  />
);

const InputNum: React.FC<{
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
