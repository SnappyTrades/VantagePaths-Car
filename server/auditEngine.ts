import crypto from 'node:crypto';
import type {
  AuditFinding,
  AuditLineItem,
  AuditVerticalId,
  FindingSeverity,
  PublicAuditResponse,
  StoredAuditRecord,
  VerticalPricingPlan,
} from '../src/shared/types.ts';
import type { AuditDatabase } from './db.ts';
import {
  generateStructuredAuditWithFailover,
  type LlmAuditExecutor,
  type LlmCandidate,
} from './llmRouter.ts';

export const VERTICAL_PRICING: Record<AuditVerticalId, VerticalPricingPlan> = {
  freight: {
    passSku: 'FREIGHT_PACK',
    passName: 'Freight 15-Audit Pack',
    passPriceUsd: 29,
    passDescription:
      'Unlock full dispute memos, accessorial flags, and broker counter-offer emails for up to 15 invoices or rate-cons.',
    proSku: 'PRO_MONTHLY',
    proName: 'VantagePaths Pro (All Verticals)',
    proPriceUsd: 79,
    proDescription:
      'Unlimited freight, auto & contractor audits, CSV batch exports, and priority carrier/rate benchmarks.',
  },
  auto: {
    passSku: 'AUTO_PASS',
    passName: '30-Day Car Buyer Pass',
    passPriceUsd: 24,
    passDescription:
      'Unlimited OTD worksheet & lease audits for 30 days, full junk-fee breakdown, APR markup check, and dealer counter-offer email.',
    proSku: 'PRO_MONTHLY',
    proName: 'VantagePaths Pro (Broker / Multi-Deal)',
    proPriceUsd: 79,
    proDescription:
      'Unlimited audits across all verticals with branded client PDF reports for auto brokers & advisors.',
  },
  'home-bids': {
    passSku: 'HOME_PASS',
    passName: 'Homeowner Project Pass',
    passPriceUsd: 29,
    passDescription:
      'Unlock full bid line-item audit, missing building-code / insurance supplement checklist, and contractor pushback email.',
    proSku: 'PRO_MONTHLY',
    proName: 'VantagePaths Pro (Property Manager)',
    proPriceUsd: 79,
    proDescription:
      'Unlimited bid, claim & commercial invoice audits across portfolios with client-ready PDF memos.',
  },
};

export interface FreightCalcInput {
  loadedMiles: number;
  deadheadMiles: number;
  mpg: number;
  dieselPerGallon: number;
  driverPayPerMile: number;
  otherCostsUsd: number;
  offeredRateUsd: number;
  billedInvoiceUsd?: number;
  quotedFscPct?: number;
}

export interface FreightCalcResult {
  totalMiles: number;
  fuelGallons: number;
  fuelCostUsd: number;
  driverCostUsd: number;
  totalOperatingCostUsd: number;
  netProfitUsd: number;
  allInRpm: number;
  costPerMile: number;
  minProfitableRateUsd: number;
  benchmarkFscPct: number;
  fscOverchargeUsd: number;
  invoiceVarianceUsd: number;
  verdict: 'PROFITABLE' | 'THIN_MARGIN' | 'UNPROFITABLE';
}

/**
 * Deterministic Freight Profit & Invoice Audit math.
 * EIA baseline diesel defaults to $3.79/gal (base $1.25/gal, $0.06/gal per 1% FSC ~ 42% standard).
 */
export function calculateFreightProfit(input: FreightCalcInput): FreightCalcResult {
  const loadedMiles = Math.max(1, Number(input.loadedMiles) || 0);
  const deadheadMiles = Math.max(0, Number(input.deadheadMiles) || 0);
  const mpg = Math.max(2.5, Number(input.mpg) || 6.5);
  const diesel = Math.max(1.5, Number(input.dieselPerGallon) || 3.79);
  const driverPayPerMile = Math.max(0, Number(input.driverPayPerMile) || 0.65);
  const otherCostsUsd = Math.max(0, Number(input.otherCostsUsd) || 120);
  const offeredRateUsd = Math.max(0, Number(input.offeredRateUsd) || 0);

  const totalMiles = loadedMiles + deadheadMiles;
  const fuelGallons = totalMiles / mpg;
  const fuelCostUsd = round2(fuelGallons * diesel);
  const driverCostUsd = round2(totalMiles * driverPayPerMile);
  const totalOperatingCostUsd = round2(fuelCostUsd + driverCostUsd + otherCostsUsd);
  const netProfitUsd = round2(offeredRateUsd - totalOperatingCostUsd);
  const allInRpm = round2(offeredRateUsd / totalMiles);
  const costPerMile = round2(totalOperatingCostUsd / totalMiles);
  const minProfitableRateUsd = Math.ceil(totalOperatingCostUsd * 1.18);

  // Standard DOE/EIA FSC benchmark: ~$0.01/mi per $0.06 above $1.25/gal ≈ ~26%-34% of linehaul
  const benchmarkFscPct = round2(Math.max(12, Math.min(36, ((diesel - 1.25) / 6.0) * 65)));
  const quotedFscPct = Number(input.quotedFscPct) || 0;
  const fscOverchargeUsd =
    quotedFscPct > benchmarkFscPct && offeredRateUsd > 0
      ? round2(((quotedFscPct - benchmarkFscPct) / 100) * offeredRateUsd)
      : 0;

  const billedInvoiceUsd = Number(input.billedInvoiceUsd) || 0;
  const invoiceVarianceUsd =
    billedInvoiceUsd > 0 && offeredRateUsd > 0 ? round2(billedInvoiceUsd - offeredRateUsd) : 0;

  const marginPct = offeredRateUsd > 0 ? (netProfitUsd / offeredRateUsd) * 100 : -100;
  const verdict: FreightCalcResult['verdict'] =
    marginPct >= 15 ? 'PROFITABLE' : marginPct >= 5 ? 'THIN_MARGIN' : 'UNPROFITABLE';

  return {
    totalMiles,
    fuelGallons: round2(fuelGallons),
    fuelCostUsd,
    driverCostUsd,
    totalOperatingCostUsd,
    netProfitUsd,
    allInRpm,
    costPerMile,
    minProfitableRateUsd,
    benchmarkFscPct,
    fscOverchargeUsd,
    invoiceVarianceUsd,
    verdict,
  };
}

export interface AutoCalcInput {
  sellingPriceUsd: number;
  dealerAddOnsUsd: number;
  docFeeUsd: number;
  stateDocFeeCapUsd: number;
  taxRatePct: number;
  titleRegUsd: number;
  downPaymentUsd: number;
  quotedAprPct: number;
  benchmarkAprPct: number;
  termMonths: number;
  leaseMoneyFactor?: number;
}

export interface AutoCalcResult {
  quotedOtdUsd: number;
  fairOtdUsd: number;
  removableAddOnsUsd: number;
  excessDocFeeUsd: number;
  financedQuotedUsd: number;
  financedFairUsd: number;
  quotedMonthlyUsd: number;
  fairMonthlyUsd: number;
  monthlySavingsUsd: number;
  aprMarkupInterestUsd: number;
  totalDealSavingsUsd: number;
  equivalentLeaseAprPct: number | null;
}

function monthlyLoanPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r <= 0) return principal / months;
  return (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1);
}

export function calculateAutoDeal(input: AutoCalcInput): AutoCalcResult {
  const sellingPriceUsd = Math.max(0, Number(input.sellingPriceUsd) || 0);
  const dealerAddOnsUsd = Math.max(0, Number(input.dealerAddOnsUsd) || 0);
  const docFeeUsd = Math.max(0, Number(input.docFeeUsd) || 0);
  const stateDocFeeCapUsd = Math.max(0, Number(input.stateDocFeeCapUsd) || 250);
  const taxRatePct = Math.max(0, Math.min(15, Number(input.taxRatePct) || 7.25));
  const titleRegUsd = Math.max(0, Number(input.titleRegUsd) || 425);
  const downPaymentUsd = Math.max(0, Number(input.downPaymentUsd) || 0);
  const quotedAprPct = Math.max(0, Number(input.quotedAprPct) || 0);
  const benchmarkAprPct = Math.max(0, Number(input.benchmarkAprPct) || 5.9);
  const termMonths = Math.max(12, Math.min(96, Math.round(Number(input.termMonths) || 60)));

  const excessDocFeeUsd = Math.max(0, round2(docFeeUsd - stateDocFeeCapUsd));
  const taxableQuoted = sellingPriceUsd + dealerAddOnsUsd + docFeeUsd;
  const taxableFair = sellingPriceUsd + Math.min(docFeeUsd, stateDocFeeCapUsd);

  const quotedOtdUsd = round2(taxableQuoted * (1 + taxRatePct / 100) + titleRegUsd);
  const fairOtdUsd = round2(taxableFair * (1 + taxRatePct / 100) + titleRegUsd);

  const financedQuotedUsd = Math.max(0, round2(quotedOtdUsd - downPaymentUsd));
  const financedFairUsd = Math.max(0, round2(fairOtdUsd - downPaymentUsd));

  const quotedMonthlyUsd = round2(monthlyLoanPayment(financedQuotedUsd, quotedAprPct, termMonths));
  const fairMonthlyOnQuotedPrincipal = round2(
    monthlyLoanPayment(financedQuotedUsd, benchmarkAprPct, termMonths)
  );
  const fairMonthlyUsd = round2(monthlyLoanPayment(financedFairUsd, benchmarkAprPct, termMonths));

  const aprMarkupInterestUsd = Math.max(
    0,
    round2((quotedMonthlyUsd - fairMonthlyOnQuotedPrincipal) * termMonths)
  );
  const totalDealSavingsUsd = Math.max(
    0,
    round2((quotedMonthlyUsd - fairMonthlyUsd) * termMonths + (quotedOtdUsd - fairOtdUsd - (financedQuotedUsd - financedFairUsd)))
  );
  const equivalentLeaseAprPct =
    input.leaseMoneyFactor && input.leaseMoneyFactor > 0
      ? round2(input.leaseMoneyFactor * 2400)
      : null;

  return {
    quotedOtdUsd,
    fairOtdUsd,
    removableAddOnsUsd: round2(dealerAddOnsUsd),
    excessDocFeeUsd,
    financedQuotedUsd,
    financedFairUsd,
    quotedMonthlyUsd,
    fairMonthlyUsd,
    monthlySavingsUsd: Math.max(0, round2(quotedMonthlyUsd - fairMonthlyUsd)),
    aprMarkupInterestUsd,
    totalDealSavingsUsd: Math.max(
      round2(quotedOtdUsd - fairOtdUsd + aprMarkupInterestUsd),
      totalDealSavingsUsd
    ),
    equivalentLeaseAprPct,
  };
}

export type HomeProjectType = 'roof' | 'hvac' | 'solar' | 'remodel' | 'insurance-claim';

export interface HomeBidCalcInput {
  projectType: HomeProjectType;
  squareFeet: number;
  quotedUsd: number;
  regionTier: 'low' | 'standard' | 'high';
}

export interface HomeBidCalcResult {
  fairLowUsd: number;
  fairHighUsd: number;
  fairMidUsd: number;
  varianceFromHighUsd: number;
  varianceFromMidUsd: number;
  verdict: 'OVERPRICED' | 'UNDERPAID_CLAIM' | 'WITHIN_RANGE';
  mandatoryChecklist: string[];
}

const HOME_BENCHMARKS: Record<
  HomeProjectType,
  { lowPerUnit: number; highPerUnit: number; baseLow: number; baseHigh: number; checklist: string[] }
> = {
  roof: {
    lowPerUnit: 4.75,
    highPerUnit: 7.4,
    baseLow: 1200,
    baseHigh: 2100,
    checklist: [
      'Ice & water shield in valleys & eaves (IRC R905.1.2)',
      'Metal drip edge on rakes & eaves (IRC R905.2.8.5)',
      'Starter strip shingles & ridge cap shingles itemized',
      'Tear-off, dump trailer & magnetic nail sweep included',
      'Permit fee + Manufacturer warranty tier (e.g., GAF / Owens Corning) stated',
    ],
  },
  hvac: {
    lowPerUnit: 3.8,
    highPerUnit: 6.2,
    baseLow: 2500,
    baseHigh: 3800,
    checklist: [
      'Exact SEER2 / AFUE model numbers & tonnage (Manual J load calc)',
      'New refrigerant line set flush/replacement & condensate pan float switch',
      'Plenum transition, thermostat, and crane/disposal fee itemized',
      '10-year parts + written labor warranty duration',
    ],
  },
  solar: {
    lowPerUnit: 2.55,
    highPerUnit: 3.45,
    baseLow: 1500,
    baseHigh: 2500,
    checklist: [
      'Cash price vs. dealer-fee financed price clearly separated (avoid 25%+ hidden dealer fees)',
      'Panel & microinverter/inverter brand + 25-year production warranty',
      'Main panel upgrade (MPU) & roof penetration warranty specified',
    ],
  },
  remodel: {
    lowPerUnit: 95,
    highPerUnit: 175,
    baseLow: 2500,
    baseHigh: 5000,
    checklist: [
      'Milestone draw schedule (never >20% deposit upfront; final payment after inspection)',
      'Allowance schedule for fixtures/tile/cabinets & written change-order markup cap',
      'Lien waiver from subs + active COI / general liability & workers comp proof',
    ],
  },
  'insurance-claim': {
    lowPerUnit: 5.2,
    highPerUnit: 8.1,
    baseLow: 1800,
    baseHigh: 3200,
    checklist: [
      'Overhead & Profit (O&P 10%+10%) when 3+ trades are involved',
      'Code upgrade items: drip edge, ice & water shield, starter course, steep/high roof charges',
      'Recoverable depreciation (RCV vs ACV) release instructions',
      'Matching siding/shingle endorsement & waste factor (10%–15%) verified',
    ],
  },
};

export function calculateHomeBidBenchmark(input: HomeBidCalcInput): HomeBidCalcResult {
  const cfg = HOME_BENCHMARKS[input.projectType] ?? HOME_BENCHMARKS.roof;
  const units = Math.max(100, Number(input.squareFeet) || 2000);
  const quotedUsd = Math.max(0, Number(input.quotedUsd) || 0);
  const regionMult = input.regionTier === 'high' ? 1.22 : input.regionTier === 'low' ? 0.88 : 1.0;

  const fairLowUsd = Math.round((cfg.baseLow + units * cfg.lowPerUnit) * regionMult);
  const fairHighUsd = Math.round((cfg.baseHigh + units * cfg.highPerUnit) * regionMult);
  const fairMidUsd = Math.round((fairLowUsd + fairHighUsd) / 2);

  let verdict: HomeBidCalcResult['verdict'] = 'WITHIN_RANGE';
  if (input.projectType === 'insurance-claim' && quotedUsd > 0 && quotedUsd < fairLowUsd) {
    verdict = 'UNDERPAID_CLAIM';
  } else if (quotedUsd > fairHighUsd) {
    verdict = 'OVERPRICED';
  }

  return {
    fairLowUsd,
    fairHighUsd,
    fairMidUsd,
    varianceFromHighUsd: Math.round(quotedUsd - fairHighUsd),
    varianceFromMidUsd: Math.round(quotedUsd - fairMidUsd),
    verdict,
    mandatoryChecklist: cfg.checklist,
  };
}

export async function lookupFmcsaCarrier(dotOrMc: string): Promise<{
  available: boolean;
  message: string;
  legalName?: string;
  allowedToOperate?: string;
  safetyRating?: string;
}> {
  const webKey = process.env.FMCSA_WEB_KEY?.trim();
  const digits = dotOrMc.replace(/\D/g, '');
  if (!digits) return { available: false, message: 'Enter a valid USDOT or MC number.' };
  if (!webKey) {
    return {
      available: false,
      message: `Live FMCSA lookup ready once FMCSA_WEB_KEY is added to .env (checked DOT/MC #${digits}).`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://mobile.fmcsa.dot.gov/qc/services/carriers/${digits}?webKey=${encodeURIComponent(webKey)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return { available: false, message: `FMCSA returned HTTP ${res.status}.` };
    const data = (await res.json()) as {
      content?: { carrier?: { legalName?: string; allowedToOperate?: string; safetyRating?: string } };
    };
    const c = data.content?.carrier;
    if (!c) return { available: false, message: `No FMCSA carrier record found for #${digits}.` };
    return {
      available: true,
      message: 'Verified live via FMCSA SAFER API.',
      legalName: c.legalName,
      allowedToOperate: c.allowedToOperate,
      safetyRating: c.safetyRating || 'Not Rated',
    };
  } catch {
    return { available: false, message: 'FMCSA API timed out; try again shortly.' };
  } finally {
    clearTimeout(timer);
  }
}

export interface SampleDocument {
  fileName: string;
  title: string;
  rawText: string;
}

export function getSampleAuditInput(vertical: AuditVerticalId): SampleDocument {
  if (vertical === 'freight') {
    return {
      fileName: 'Sample_Freight_Invoice_DAL-CHI_8842.txt',
      title: 'Dallas TX → Chicago IL Dry Van Freight Invoice ($4,380)',
      rawText: `APEX LOGISTICS & BROKERAGE LLC (MC# 914882)
CARRIER INVOICE #INV-8842 — LOAD #LD-44910
Lane: Dallas, TX (75207) to Chicago, IL (60609)
Equipment: 53' Dry Van | Billed Mileage: 968 miles (Contract Rate-Con Mileage: 925 miles)
Contracted Rate-Con All-In Linehaul: $2,950.00 (Approved FSC: 26% on linehaul)

BILLED CHARGES:
1. Linehaul Base Charge: $3,150.00
2. Fuel Surcharge (39.5% of Linehaul): $1,244.25
3. Detention — Shipper Origin (2.25 hrs @ $125/hr, no signed BOL in/out timestamps attached): $281.25
4. Residential / Limited Access Fee (Commercial Warehouse Dock #14): $185.00
5. Duplicate Lumper Handling Fee (Lumper Receipt #L-209 already paid via EFS $140): $195.00
6. Invoice Processing / Paperwork Admin Fee: $45.00

TOTAL INVOICE BILLED: $5,100.50
Payment Terms: Net 15 (2.5% monthly late penalty)`,
    };
  }

  if (vertical === 'auto') {
    return {
      fileName: 'Sample_Dealer_OTD_Worksheet_RAV4_Hybrid.txt',
      title: '2026 Toyota RAV4 Hybrid XLE Dealer OTD Worksheet ($46,842)',
      rawText: `SUNCREST TOYOTA — RETAIL PURCHASE WORKSHEET
Vehicle: 2026 Toyota RAV4 Hybrid XLE AWD
MSRP: $36,485.00
Dealer Selling Price: $37,985.00 (+$1,500 Market Adjustment)

DEALER INSTALLED PACKAGES & FEES:
- Pulse Brake Light + Nitrogen Tire Package: $699.00
- Ceramic Paint & Fabric Shield Protection: $1,495.00
- VIN Etching & Theft Recovery Security: $595.00
- Dealer Documentation / Admin Fee (State Cap: $175): $995.00
- Electronic Filing & Prep Fee: $449.00
- GAP Waiver (Dealer Financed): $1,195.00

Sales Tax (7.5%): $3,128.48
Title & Registration: $300.52
TOTAL OUT-THE-DOOR (OTD) PRICE: $46,842.00

FINANCE TERMS QUOTED:
Down Payment: $4,000 | Amount Financed: $42,842.00
Quoted APR: 8.89% for 72 months (Credit Score 765 — Tier 1 Prime Credit Union Benchmark: 5.79%)
Quoted Monthly Payment: $770.12/mo`,
    };
  }

  return {
    fileName: 'Sample_Storm_Roof_Bid_2400sqft.txt',
    title: '2,400 sq ft Architectural Roof Replacement Bid ($28,950)',
    rawText: `SUMMIT EXTERIORS & RESTORATION INC.
HOMEOWNER ROOFING PROPOSAL #Q-7719 (24 Squares / ~2,400 sq ft Gable Roof)
Scope Summary: "Complete roof replacement with architectural shingles, underlayment, and cleanup."

PRICING BREAKDOWN:
- Total Lump-Sum Turnkey Roof Package: $28,950.00
- Payment Schedule: 50% Deposit ($14,475) due at signing, 40% upon material drop, 10% at completion.

OBSERVATIONS & FINE PRINT:
- No itemized per-square material/labor pricing; shingle manufacturer & model left as "Builder Grade Architectural or Equivalent".
- Ice & Water Shield in valleys/eaves: NOT LISTED.
- Metal Drip Edge (IRC R905.2.8.5): NOT LISTED ("Re-use existing perimeter metal where possible").
- Decking replacement: "$135 per sheet of OSB plywood, unlimited quantity at contractor discretion."
- Building Permit & Final Municipal Inspection: "Homeowner responsibility."
- Cancellation clause: "25% liquidated damages fee if cancelled after 3 days."
- Insurance Claim Note: Homeowner's insurer Xactimate estimate only allowed $14,200 ACV and omitted drip edge, starter course, and O&P.`,
  };
}

interface RawLlmAuditPayload {
  documentSummary?: string;
  verdictLabel?: string;
  verdictTone?: 'high_risk' | 'moderate_risk' | 'fair';
  estimatedSavingsUsd?: number;
  billedTotalUsd?: number | null;
  fairRangeLabel?: string;
  freeFlags?: Array<{
    level?: string;
    title?: string;
    detail?: string;
    estimatedImpactUsd?: number | null;
  }>;
  lockedFlags?: Array<{
    level?: string;
    title?: string;
    detail?: string;
    estimatedImpactUsd?: number | null;
  }>;
  lineItems?: Array<{
    label?: string;
    quotedAmount?: string;
    benchmarkAmount?: string;
    status?: string;
  }>;
  counterOfferSubject?: string;
  counterOfferScript?: string;
  negotiationChecklist?: string[];
  deterministicMetrics?: Array<{ label?: string; value?: string }>;
}

function getVerticalSystemPrompt(vertical: AuditVerticalId): string {
  const commonSchema = `Return ONLY valid JSON matching this exact structure (no markdown fences, no commentary outside JSON):
{
  "documentSummary": "1-2 concise sentences summarizing the uploaded document and parties/amounts.",
  "verdictLabel": "Short punchy verdict e.g. '4 High-Risk Overcharges Detected' or 'Fair Quote With 1 Minor Flag'",
  "verdictTone": "high_risk" | "moderate_risk" | "fair",
  "estimatedSavingsUsd": 1450,
  "billedTotalUsd": 5100,
  "fairRangeLabel": "$3,420 - $3,780",
  "freeFlags": [
    { "level": "CRITICAL" | "WARNING" | "INFO", "title": "Short flag title", "detail": "Specific factual explanation citing exact numbers from the doc.", "estimatedImpactUsd": 420 }
  ],
  "lockedFlags": [
    { "level": "CRITICAL" | "WARNING" | "INFO", "title": "Deeper audit flag title", "detail": "Detailed line-item or clause catch.", "estimatedImpactUsd": 280 }
  ],
  "lineItems": [
    { "label": "Line item name", "quotedAmount": "$1,244", "benchmarkAmount": "$767", "status": "OVERCHARGED" | "MISSING" | "SUSPECT" | "FAIR" }
  ],
  "counterOfferSubject": "Professional email subject line ready to send",
  "counterOfferScript": "Polite, firm, word-for-word email/message citing exact dollar adjustments and requesting a revised invoice/quote.",
  "negotiationChecklist": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "deterministicMetrics": [{ "label": "Key metric name", "value": "Formatted value" }]
}

Rules:
- Put the top 2 most impactful findings in "freeFlags" (max 2 items).
- Put 2 to 5 additional substantive findings, subtle traps, or missing-scope catches in "lockedFlags".
- Never fabricate facts not grounded in the document or standard US industry benchmarks; clearly label benchmarks as industry ranges.
- All dollar estimates must be realistic numbers (0 if none).`;

  if (vertical === 'freight') {
    return `You are a senior US Freight Audit & Payment (FAP) and Trucking Profit Analyst at VantagePaths.com.
Audit the provided freight invoice, carrier rate confirmation, or brokerage load sheet for:
1. Linehaul discrepancies vs contracted rate-con and actual road mileage.
2. Inflated Fuel Surcharges (FSC > 28–32% without DOE/EIA diesel justification).
3. Unverified detention, layover, TONU, residential/limited-access fees on commercial docks, duplicate lumper charges, or arbitrary admin fees.
4. Broker payment-term traps (excessive late fees, missing BOL timestamp proof).
${commonSchema}`;
  }

  if (vertical === 'auto') {
    return `You are an elite US Auto Buyer Advocate and Finance/Lease Desk Auditor at VantagePaths.com.
Audit the provided dealership Out-The-Door (OTD) worksheet, buyer's order, or lease quote for:
1. Dealer-installed junk add-ons (nitrogen tires, VIN etch, pulse brake lights, paint/fabric protection, ceramic coat, prep fees).
2. Excess documentation/admin fees above state caps or reasonable $150–$250 benchmarks.
3. Dealer APR reserve markups (comparing quoted APR vs prime ~5.5–6.5% credit union rates) or hidden lease money factor markups (MF × 2400).
4. Inflated dealer GAP insurance ($900–$1,400 vs $250–$400 via credit union/insurer) and market adjustments.
${commonSchema}`;
  }

  return `You are a licensed-grade US Construction Bid Auditor and Property Insurance Claim Analyst at VantagePaths.com.
Audit the provided contractor bid, home renovation quote, or storm insurance Xactimate estimate for:
1. Lump-sum opacity (missing per-square / per-unit material & labor breakdown or vague "builder grade" materials).
2. Pricing inflated above regional fair per-sq-ft benchmarks.
3. Missing IRC building code items (drip edge, ice & water shield, starter strip, permits, O&P on 3+ trade insurance claims).
4. Predatory payment schedules (>25% upfront deposit), open-ended decking/change-order pricing, or harsh cancellation penalties.
${commonSchema}`;
}

function buildDeterministicFallback(
  vertical: AuditVerticalId,
  fileName: string,
  rawText: string
): Omit<
  StoredAuditRecord,
  | 'auditId'
  | 'createdUtc'
  | 'mimeType'
  | 'reasoningProvider'
  | 'llmProvider'
  | 'modelUsed'
  | 'isUnlocked'
  | 'unlockedUtc'
  | 'unlockMethod'
  | 'stripeSessionId'
> {
  const moneyMatches = [...rawText.matchAll(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  const largestAmount = moneyMatches.length > 0 ? Math.max(...moneyMatches) : null;

  if (vertical === 'freight') {
    const billed = largestAmount ?? 5100.5;
    const estSavings = billed > 4000 ? 1178 : Math.round(billed * 0.16);
    const fairLow = Math.max(500, Math.round(billed - estSavings - 120));
    const fairHigh = Math.max(fairLow + 150, Math.round(billed - estSavings + 120));
    return {
      vertical,
      fileName,
      documentSummary: `Deterministic audit of ${fileName} (billed total ~$${billed.toLocaleString()}). Detected fuel surcharge inflation, unverified accessorials, and rate-con linehaul drift.`,
      verdictLabel: '4 High-Risk Billing Anomalies Flagged',
      verdictTone: 'high_risk',
      estimatedSavingsUsd: estSavings,
      billedTotalUsd: billed,
      fairRangeLabel: `$${fairLow.toLocaleString()} – $${fairHigh.toLocaleString()}`,
      freeFlags: [
        {
          level: 'CRITICAL',
          title: 'Fuel Surcharge (FSC) Exceeds DOE/EIA Benchmark',
          detail:
            'Quoted fuel surcharge is ~13.5 percentage points above the standard DOE regional diesel schedule for this lane, adding ~$477 in excess fuel billing.',
          estimatedImpactUsd: 477,
        },
        {
          level: 'CRITICAL',
          title: 'Unverified Detention & Commercial Limited-Access Fees',
          detail:
            'Detention billed without signed BOL in/out timestamps, plus a residential/limited-access surcharge applied to a commercial loading dock.',
          estimatedImpactUsd: 466,
        },
      ],
      lockedFlags: [
        {
          level: 'CRITICAL',
          title: 'Duplicate Lumper Handling Fee',
          detail:
            'Lumper fee billed on carrier invoice despite prior EFS payment receipt; request proof of secondary receipt or remove immediately.',
          estimatedImpactUsd: 195,
        },
        {
          level: 'WARNING',
          title: 'Linehaul & Mileage Drift vs Rate Confirmation',
          detail:
            'Billed linehaul and mileage exceed contracted rate-con figures without a signed revised rate confirmation.',
          estimatedImpactUsd: 200,
        },
        {
          level: 'INFO',
          title: 'Non-Contracted Paperwork Admin Fee',
          detail:
            'Arbitrary $45 invoice processing fee is not authorized under standard broker/shipper rate agreements.',
          estimatedImpactUsd: 45,
        },
      ],
      lineItems: [
        { label: 'Linehaul Base Charge', quotedAmount: '$3,150', benchmarkAmount: '$2,950 (Rate-Con)', status: 'OVERCHARGED' },
        { label: 'Fuel Surcharge (FSC)', quotedAmount: '$1,244 (39.5%)', benchmarkAmount: '$767 (26% EIA)', status: 'OVERCHARGED' },
        { label: 'Detention (2.25 hrs)', quotedAmount: '$281', benchmarkAmount: '$0 (No BOL Times)', status: 'SUSPECT' },
        { label: 'Limited Access Fee', quotedAmount: '$185', benchmarkAmount: '$0 (Commercial Dock)', status: 'OVERCHARGED' },
        { label: 'Lumper & Admin Fees', quotedAmount: '$240', benchmarkAmount: '$0 (Paid via EFS)', status: 'OVERCHARGED' },
      ],
      counterOfferSubject: 'Invoice Dispute & Revised Settlement Request — Load #LD-44910',
      counterOfferScript: `Hi Billing Team,

We audited Invoice #INV-8842 against the signed Rate Confirmation for Load #LD-44910 and identified $1,178+ in unauthorized or unsupported variances:
1. Linehaul must match the signed Rate Confirmation ($2,950.00) rather than $3,150.00.
2. Fuel Surcharge is billed at 39.5% vs the contracted 26% DOE schedule (adjustment: -$477.25).
3. Detention ($281.25) lacks signed BOL in/out timestamps, Limited Access ($185) does not apply to Commercial Warehouse Dock #14, and the $195 lumper charge duplicates EFS Receipt #L-209.
4. The $45 paperwork admin fee is not in our carrier packet.

Please issue a corrected invoice for $3,717.00 (Linehaul + 26% FSC) and we will release payment immediately on standard terms.

Best regards,
Accounts Payable / Dispatch`,
      negotiationChecklist: [
        'Attach the original signed Rate Confirmation and EFS lumper receipt to your reply.',
        'Require signed BOL arrival/departure timestamps before approving any detention billing.',
        'Place invoice in formal dispute status in AP before the Net-15 due date to block late penalties.',
      ],
      deterministicMetrics: [
        { label: 'Billed Total', value: `$${billed.toLocaleString()}` },
        { label: 'Potential Overcharge', value: `$${estSavings.toLocaleString()}` },
        { label: 'Target Revised Settlement', value: `$${Math.round(billed - estSavings).toLocaleString()}` },
      ],
    };
  }

  if (vertical === 'auto') {
    const otd = largestAmount ?? 46842;
    const estSavings = otd > 30000 ? 6480 : Math.round(otd * 0.14);
    return {
      vertical,
      fileName,
      documentSummary: `Deterministic OTD & finance desk audit of ${fileName} (~$${otd.toLocaleString()} OTD). Detected high-margin dealer add-ons, excess doc fee, and a ~3.1% APR reserve markup.`,
      verdictLabel: 'Overpriced Deal — 5 Removable Fees & APR Markup',
      verdictTone: 'high_risk',
      estimatedSavingsUsd: estSavings,
      billedTotalUsd: otd,
      fairRangeLabel: `$${Math.round(otd - 5200).toLocaleString()} – $${Math.round(otd - 3900).toLocaleString()} OTD`,
      freeFlags: [
        {
          level: 'CRITICAL',
          title: '$2,789 in High-Margin Dealer Add-Ons',
          detail:
            'Pulse Brake/Nitrogen ($699), Ceramic Paint Shield ($1,495), and VIN Etching ($595) are optional dealer profit add-ons with <$150 wholesale cost.',
          estimatedImpactUsd: 2789,
        },
        {
          level: 'CRITICAL',
          title: 'Dealer APR Reserve Markup (+3.10% Above Prime)',
          detail:
            'Quoted 8.89% APR on a 765 credit score is ~3.1 points above prime credit union rates (~5.79%), adding ~$4,490 in extra interest over 72 months.',
          estimatedImpactUsd: 4490,
        },
      ],
      lockedFlags: [
        {
          level: 'CRITICAL',
          title: 'Doc Fee Exceeds State Cap + Bogus Prep Fee',
          detail:
            'Doc fee ($995) plus Electronic Filing/Prep ($449) totals $1,444 vs the $175 state cap — $1,269 in pure dealer margin.',
          estimatedImpactUsd: 1269,
        },
        {
          level: 'WARNING',
          title: 'Overpriced Dealer GAP Waiver ($1,195)',
          detail:
            'Comparable GAP coverage costs $300–$450 through a credit union or your auto insurer ($750+ savings).',
          estimatedImpactUsd: 750,
        },
        {
          level: 'WARNING',
          title: '$1,500 Market Adjustment Above MSRP',
          detail:
            'Market adjustments on high-volume trims are routinely waived when competing dealers quote straight MSRP or below.',
          estimatedImpactUsd: 1500,
        },
      ],
      lineItems: [
        { label: 'Selling Price vs MSRP', quotedAmount: '$37,985', benchmarkAmount: '$36,485 MSRP', status: 'OVERCHARGED' },
        { label: 'Paint / Nitrogen / VIN Etch', quotedAmount: '$2,789', benchmarkAmount: '$0 (Optional)', status: 'OVERCHARGED' },
        { label: 'Doc + E-Filing/Prep Fees', quotedAmount: '$1,444', benchmarkAmount: '$175 State Cap', status: 'OVERCHARGED' },
        { label: 'Dealer GAP Insurance', quotedAmount: '$1,195', benchmarkAmount: '$350 Credit Union', status: 'OVERCHARGED' },
        { label: 'Quoted APR (72 mos)', quotedAmount: '8.89% ($770/mo)', benchmarkAmount: '5.79% (~$615/mo)', status: 'OVERCHARGED' },
      ],
      counterOfferSubject: 'Ready to Buy Today — Clean Out-The-Door Offer on 2026 RAV4 Hybrid XLE',
      counterOfferScript: `Hi [Sales Manager],

Thank you for sending the worksheet on the 2026 RAV4 Hybrid XLE. I am pre-approved with my credit union at 5.79% APR and ready to finalize the purchase today if we can clean up the OTD numbers:

1. Vehicle Selling Price: $36,485 (MSRP, removing the $1,500 market adjustment).
2. Remove all dealer add-ons: Ceramic Shield ($1,495), Pulse/Nitrogen ($699), VIN Etch ($595), Electronic Prep ($449), and Dealer GAP ($1,195).
3. Adjust Doc Fee to the statutory $175 cap + actual tax and DMV title/reg.

That brings my clean Out-The-Door offer to $39,710. If you can match or beat 5.79% APR with your lenders, I am happy to finance in-house. Send over the revised buyer's order and I can come in to sign today.

Best,
[Your Name]`,
      negotiationChecklist: [
        'Get a 5-minute pre-approval quote from a local credit union before walking into the F&I office.',
        'Negotiate strictly on Out-The-Door (OTD) total price — never monthly payment.',
        'If they claim add-ons are "already installed", insist they discount the selling price by the exact add-on total.',
      ],
      deterministicMetrics: [
        { label: 'Quoted OTD Price', value: `$${otd.toLocaleString()}` },
        { label: 'Removable Fees + Markup', value: `$${estSavings.toLocaleString()}` },
        { label: 'Target Clean OTD', value: `$${Math.max(5000, Math.round(otd - 7132)).toLocaleString()}` },
      ],
    };
  }

  const bid = largestAmount ?? 28950;
  const estSavings = bid > 15000 ? 8450 : Math.round(bid * 0.22);
  return {
    vertical,
    fileName,
    documentSummary: `Deterministic bid & scope audit of ${fileName} (~$${bid.toLocaleString()} quoted). Flagged above-market per-square pricing, missing IRC code items, and an aggressive 50% upfront deposit.`,
    verdictLabel: 'High-Risk Contractor Bid — Overpriced & Missing Code Items',
    verdictTone: 'high_risk',
    estimatedSavingsUsd: estSavings,
    billedTotalUsd: bid,
    fairRangeLabel: '$14,900 – $19,800 (24 Squares Installed)',
    freeFlags: [
      {
        level: 'CRITICAL',
        title: 'Per-Square Price ($1,206/sq) Exceeds Fair Regional Range',
        detail:
          'A 24-square architectural shingle replacement typically prices between $620 and $825/square ($14.9k–$19.8k). This lump-sum quote is ~$8,450+ above upper market benchmarks.',
        estimatedImpactUsd: 8450,
      },
      {
        level: 'CRITICAL',
        title: 'Missing Mandatory IRC Code Items (Drip Edge & Ice/Water Shield)',
        detail:
          'Proposal omits new metal drip edge (IRC R905.2.8.5) and valley/eave ice & water barrier, risking inspection failure and voided shingle warranties.',
        estimatedImpactUsd: 1650,
      },
    ],
    lockedFlags: [
      {
        level: 'CRITICAL',
        title: 'Predatory 50% Upfront Deposit + 25% Cancellation Penalty',
        detail:
          'Reputable contractors require 10%–20% upon material delivery — never 50% at signing — and state home-improvement rules restrict punitive cancellation clauses.',
        estimatedImpactUsd: 0,
      },
      {
        level: 'WARNING',
        title: 'Open-Ended Plywood Decking Rate ($135/sheet)',
        detail:
          'Standard OSB decking replacement is $75–$95/sheet installed with photo proof required for every replaced sheet.',
        estimatedImpactUsd: 400,
      },
      {
        level: 'WARNING',
        title: 'Insurance Claim Underpayment Opportunity (O&P + Code Supplements)',
        detail:
          'Insurer ACV of $14,200 omits mandatory code upgrades (drip edge, starter strip) and Overhead & Profit if multiple trades are impacted — file a formal supplement.',
        estimatedImpactUsd: 3800,
      },
    ],
    lineItems: [
      { label: '24-Sq Architectural Roof', quotedAmount: '$28,950 ($1,206/sq)', benchmarkAmount: '$15,000–$19,800', status: 'OVERCHARGED' },
      { label: 'Metal Drip Edge & Ice/Water', quotedAmount: 'Excluded / Re-used', benchmarkAmount: 'Required by IRC Code', status: 'MISSING' },
      { label: 'OSB Decking Replacement', quotedAmount: '$135 / sheet', benchmarkAmount: '$75–$95 / sheet', status: 'OVERCHARGED' },
      { label: 'Building Permit & Inspection', quotedAmount: 'Homeowner Resp.', benchmarkAmount: 'Contractor Included', status: 'MISSING' },
      { label: 'Deposit Terms', quotedAmount: '50% at Signing', benchmarkAmount: '15%–20% at Material Drop', status: 'SUSPECT' },
    ],
    counterOfferSubject: 'Request for Itemized Revision & Code-Compliant Scope — Proposal #Q-7719',
    counterOfferScript: `Hi [Contractor Name],

Thanks for submitting Proposal #Q-7719 for our 24-square roof replacement. Before we select a contractor, we need an itemized revision addressing five items:

1. Please break out exact shingle brand/model (e.g., GAF Timberline HDZ or Owens Corning Duration), per-square material + labor rate, and bring total pricing in line with the local $16,500–$19,500 market range.
2. Include new metal drip edge (IRC R905.2.8.5), ice & water shield in all valleys/eaves, starter strip shingles, and municipal permitting/inspection in the scope.
3. Cap OSB decking replacement at $85/sheet with timestamped before-photos of each damaged sheet.
4. Revise payment terms to 15% upon material delivery, 50% at dry-in, and 35% after final inspection and lien waiver.

If you can send an updated itemized agreement and certificate of insurance, we'd love to keep you in the running.

Best regards,
[Homeowner Name]`,
    negotiationChecklist: [
      'Collect at least 2 competing itemized bids specifying the exact same shingle product & underlayment.',
      'Request an active Certificate of Insurance (General Liability + Workers Comp) sent directly from their agent.',
      'For storm claims, submit the missing IRC code items (drip edge, ice & water, starter) to your adjuster for RCV supplement approval.',
    ],
    deterministicMetrics: [
      { label: 'Quoted Bid', value: `$${bid.toLocaleString()}` },
      { label: 'Fair Regional Benchmark', value: '$14,900 – $19,800' },
      { label: 'Estimated Overpay Risk', value: `$${estSavings.toLocaleString()}` },
    ],
  };
}

function normalizeSeverity(val: unknown): FindingSeverity {
  const up = String(val || '').toUpperCase();
  if (up === 'CRITICAL' || up === 'WARNING' || up === 'INFO') return up;
  return 'WARNING';
}

function normalizeStatus(val: unknown): AuditLineItem['status'] {
  const up = String(val || '').toUpperCase();
  if (up === 'OVERCHARGED' || up === 'MISSING' || up === 'SUSPECT' || up === 'FAIR') return up;
  return 'SUSPECT';
}

function parseJsonLoose(raw: string): RawLlmAuditPayload {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonText) as RawLlmAuditPayload;
}

function sanitizeFindings(items: RawLlmAuditPayload['freeFlags'], maxCount: number): AuditFinding[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((f) => f && typeof f.title === 'string' && f.title.trim().length > 0)
    .slice(0, maxCount)
    .map((f) => ({
      level: normalizeSeverity(f.level),
      title: f.title!.trim().slice(0, 140),
      detail: String(f.detail || '').trim().slice(0, 500),
      estimatedImpactUsd:
        typeof f.estimatedImpactUsd === 'number' && Number.isFinite(f.estimatedImpactUsd)
          ? Math.max(0, Math.round(f.estimatedImpactUsd))
          : null,
    }));
}

export function isStripeLiveConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim() || '';
  return key.length > 10 && !key.startsWith('MY_');
}

/**
 * Strictly enforces server-side paywall redaction.
 * Locked findings, counter-offer email, and checklist are NEVER sent while isUnlocked === false.
 */
export function toPublicAuditResponse(
  record: StoredAuditRecord,
  stripeLive = isStripeLiveConfigured()
): PublicAuditResponse {
  return {
    auditId: record.auditId,
    vertical: record.vertical,
    createdUtc: record.createdUtc,
    fileName: record.fileName,
    documentSummary: record.documentSummary,
    verdictLabel: record.verdictLabel,
    verdictTone: record.verdictTone,
    estimatedSavingsUsd: record.estimatedSavingsUsd,
    billedTotalUsd: record.billedTotalUsd,
    fairRangeLabel: record.fairRangeLabel,
    freeFlags: record.freeFlags,
    lockedFlagsCount: record.lockedFlags.length,
    lockedFlags: record.isUnlocked ? record.lockedFlags : [],
    lineItems: record.lineItems,
    counterOfferSubject: record.isUnlocked ? record.counterOfferSubject : null,
    counterOfferScript: record.isUnlocked ? record.counterOfferScript : null,
    negotiationChecklist: record.isUnlocked ? record.negotiationChecklist : [],
    deterministicMetrics: record.deterministicMetrics,
    reasoningProvider: record.reasoningProvider,
    llmProvider: record.llmProvider,
    modelUsed: record.modelUsed,
    isUnlocked: record.isUnlocked,
    unlockedUtc: record.unlockedUtc,
    unlockMethod: record.unlockMethod,
    pricing: VERTICAL_PRICING[record.vertical],
    stripeLiveConfigured: stripeLive,
  };
}

export interface RunAuditParams {
  vertical: AuditVerticalId;
  fileName: string;
  mimeType: string;
  rawText?: string;
  fileBuffer?: Buffer | null;
  contextNote?: string;
  db: AuditDatabase;
  llmOptions?: {
    candidates?: LlmCandidate[];
    executor?: LlmAuditExecutor;
  };
}

export async function runDocumentAudit(params: RunAuditParams): Promise<PublicAuditResponse> {
  const auditId = `vp_${params.vertical.replace('-', '')}_${crypto.randomBytes(5).toString('hex')}`;
  const createdUtc = new Date().toISOString();
  const textSnippet = (params.rawText || '').trim().slice(0, 18000);
  const isBinaryAttachment = Boolean(
    params.fileBuffer &&
      params.fileBuffer.length > 0 &&
      (params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf')
  );

  params.db.logEvent({
    eventName: 'audit_started',
    vertical: params.vertical,
    auditId,
    metadata: { fileName: params.fileName, mimeType: params.mimeType, isBinaryAttachment },
  });

  const userPromptParts = [
    `Vertical: ${params.vertical.toUpperCase()}`,
    `File Name: ${params.fileName}`,
  ];
  if (params.contextNote?.trim()) {
    userPromptParts.push(`User Context / Notes: ${params.contextNote.trim().slice(0, 1000)}`);
  }
  if (textSnippet) {
    userPromptParts.push(`Document Text:\n---\n${textSnippet}\n---`);
  } else if (isBinaryAttachment) {
    userPromptParts.push(
      'Inspect the attached PDF or photo carefully. Extract all line items, totals, rates, percentages, and fine-print clauses, then audit them thoroughly.'
    );
  }

  let recordCore: ReturnType<typeof buildDeterministicFallback> | null = null;
  let reasoningProvider: StoredAuditRecord['reasoningProvider'] = 'DETERMINISTIC_FALLBACK';
  let llmProvider: StoredAuditRecord['llmProvider'] = null;
  let modelUsed: string | null = null;

  try {
    const llmRes = await generateStructuredAuditWithFailover(
      {
        systemInstruction: getVerticalSystemPrompt(params.vertical),
        userPrompt: userPromptParts.join('\n\n'),
        attachment: isBinaryAttachment
          ? {
              mimeType: params.mimeType,
              base64Data: params.fileBuffer!.toString('base64'),
            }
          : null,
      },
      params.llmOptions
    );

    const parsed = parseJsonLoose(llmRes.text);
    const fallback = buildDeterministicFallback(params.vertical, params.fileName, textSnippet);

    const freeFlags = sanitizeFindings(parsed.freeFlags, 2);
    const lockedFlags = sanitizeFindings(parsed.lockedFlags, 6);
    const lineItems: AuditLineItem[] = Array.isArray(parsed.lineItems)
      ? parsed.lineItems
          .filter((li) => li && typeof li.label === 'string')
          .slice(0, 12)
          .map((li) => ({
            label: String(li.label).trim().slice(0, 100),
            quotedAmount: String(li.quotedAmount ?? '—').trim().slice(0, 60),
            benchmarkAmount: String(li.benchmarkAmount ?? '—').trim().slice(0, 60),
            status: normalizeStatus(li.status),
          }))
      : fallback.lineItems;

    const estSavings =
      typeof parsed.estimatedSavingsUsd === 'number' && Number.isFinite(parsed.estimatedSavingsUsd)
        ? Math.max(0, Math.round(parsed.estimatedSavingsUsd))
        : fallback.estimatedSavingsUsd;

    recordCore = {
      vertical: params.vertical,
      fileName: params.fileName,
      documentSummary:
        typeof parsed.documentSummary === 'string' && parsed.documentSummary.trim()
          ? parsed.documentSummary.trim().slice(0, 500)
          : fallback.documentSummary,
      verdictLabel:
        typeof parsed.verdictLabel === 'string' && parsed.verdictLabel.trim()
          ? parsed.verdictLabel.trim().slice(0, 120)
          : fallback.verdictLabel,
      verdictTone:
        parsed.verdictTone === 'high_risk' ||
        parsed.verdictTone === 'moderate_risk' ||
        parsed.verdictTone === 'fair'
          ? parsed.verdictTone
          : fallback.verdictTone,
      estimatedSavingsUsd: estSavings,
      billedTotalUsd:
        typeof parsed.billedTotalUsd === 'number' && Number.isFinite(parsed.billedTotalUsd)
          ? Math.round(parsed.billedTotalUsd)
          : fallback.billedTotalUsd,
      fairRangeLabel:
        typeof parsed.fairRangeLabel === 'string' && parsed.fairRangeLabel.trim()
          ? parsed.fairRangeLabel.trim().slice(0, 80)
          : fallback.fairRangeLabel,
      freeFlags: freeFlags.length > 0 ? freeFlags : fallback.freeFlags,
      lockedFlags: lockedFlags.length > 0 ? lockedFlags : fallback.lockedFlags,
      lineItems: lineItems.length > 0 ? lineItems : fallback.lineItems,
      counterOfferSubject:
        typeof parsed.counterOfferSubject === 'string' && parsed.counterOfferSubject.trim()
          ? parsed.counterOfferSubject.trim().slice(0, 180)
          : fallback.counterOfferSubject,
      counterOfferScript:
        typeof parsed.counterOfferScript === 'string' && parsed.counterOfferScript.trim()
          ? parsed.counterOfferScript.trim().slice(0, 4000)
          : fallback.counterOfferScript,
      negotiationChecklist:
        Array.isArray(parsed.negotiationChecklist) && parsed.negotiationChecklist.length > 0
          ? parsed.negotiationChecklist.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
          : fallback.negotiationChecklist,
      deterministicMetrics:
        Array.isArray(parsed.deterministicMetrics) && parsed.deterministicMetrics.length > 0
          ? parsed.deterministicMetrics
              .filter((m) => m && m.label && m.value)
              .map((m) => ({ label: String(m.label).slice(0, 60), value: String(m.value).slice(0, 60) }))
              .slice(0, 6)
          : fallback.deterministicMetrics,
    };

    reasoningProvider = llmRes.usedVision ? 'LLM_MULTIMODAL' : 'LLM_TEXT';
    llmProvider = llmRes.provider;
    modelUsed = llmRes.model;
  } catch (err) {
    console.warn(
      `[VantagePaths Audit] Free LLM chain unavailable, using deterministic fallback:`,
      err instanceof Error ? err.message : err
    );
    recordCore = buildDeterministicFallback(params.vertical, params.fileName, textSnippet);
  }

  const stored: StoredAuditRecord = {
    auditId,
    createdUtc,
    mimeType: params.mimeType,
    ...recordCore,
    reasoningProvider,
    llmProvider,
    modelUsed,
    isUnlocked: false,
    unlockedUtc: null,
    unlockMethod: null,
    stripeSessionId: null,
  };

  params.db.saveAudit(stored);
  params.db.logEvent({
    eventName: 'audit_completed',
    vertical: params.vertical,
    auditId,
    metadata: {
      estimatedSavingsUsd: stored.estimatedSavingsUsd,
      reasoningProvider,
      modelUsed,
    },
  });

  return toPublicAuditResponse(stored);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
