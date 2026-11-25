import {
  calculateAddOnRefund,
  STATE_AUTO_RULES,
  type AddOnRefundEstimate,
  type AddOnRefundInput,
} from './autoKnowledge.ts';

export interface VinIntelligenceResult {
  vin: string;
  source: 'NHTSA_LIVE' | 'SAMPLE_FALLBACK';
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  engineSummary: string;
  fuelType: string;
  plantCountry: string;
  recallCount: number;
  recalls: Array<{
    campaignNumber: string;
    component: string;
    summary: string;
    remedy: string;
  }>;
  complaintCount: number;
  topComplaintComponents: Array<{ component: string; count: number }>;
  negotiationInsight: string;
}

export interface PartnerOffer {
  id: string;
  pillar: 'buy' | 'rescue' | 'insurance' | 'sell';
  category: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  badge: string;
  estimatedCpaUsd: number;
  estimatedEpcUsd: number;
  envKey: string;
  defaultUrl: string;
  disclosure: string;
}

export const PARTNER_OFFERS: PartnerOffer[] = [
  {
    id: 'auto-refi-credit-union',
    pillar: 'rescue',
    category: 'Auto Refinance',
    title: 'Compare Soft-Pull Credit Union & Online Auto Refinance Rates',
    subtitle:
      'Once your F&I add-on refund drops your principal & LTV below 120%, compare soft-pull refinance offers to slash a marked-up dealer APR by 2%–4%.',
    ctaLabel: 'Check Refi Rates (No Credit Impact)',
    badge: 'Soft-Pull Pre-Qual',
    estimatedCpaUsd: 85,
    estimatedEpcUsd: 4.5,
    envKey: 'AFFILIATE_AUTO_REFI_URL',
    defaultUrl: 'https://www.lendingtree.com/auto/refinance/',
    disclosure: 'Partner link — VantagePaths may earn a referral commission at $0 extra cost to you.',
  },
  {
    id: 'auto-preapproval',
    pillar: 'buy',
    category: 'Pre-Approval Financing',
    title: 'Lock In Your Own Auto Loan Pre-Approval Before Emailing Dealers',
    subtitle:
      'Walk into email negotiations holding a real competing APR so dealers cannot mark up your interest rate in the F&I box.',
    ctaLabel: 'Compare Pre-Approval APRs',
    badge: 'Beat Dealer F&I',
    estimatedCpaUsd: 75,
    estimatedEpcUsd: 3.75,
    envKey: 'AFFILIATE_PREAPPROVAL_URL',
    defaultUrl: 'https://www.bankrate.com/loans/auto-loans/rates/',
    disclosure: 'Partner link — independent rate comparison at $0 extra cost to you.',
  },
  {
    id: 'auto-insurance-compare',
    pillar: 'insurance',
    category: 'Auto Insurance & Low-Cost GAP',
    title: 'Compare Apples-to-Apples Auto Insurance & ~$250 Insurer GAP Quotes',
    subtitle:
      'Use your VantagePaths Coverage Spec Sheet to benchmark your renewal rate and replace $1,200 dealer GAP with low-cost loan/lease payoff coverage.',
    ctaLabel: 'Compare Auto Insurance Quotes',
    badge: 'Avg $480–$720/yr Saved',
    estimatedCpaUsd: 24,
    estimatedEpcUsd: 3.2,
    envKey: 'AFFILIATE_AUTO_INSURANCE_URL',
    defaultUrl: 'https://www.thezebra.com/auto-insurance/',
    disclosure: 'Partner link — VantagePaths may earn a commission when you compare quotes.',
  },
  {
    id: 'instant-cash-offer',
    pillar: 'sell',
    category: 'Instant Cash Offer',
    title: 'Pull a Binding Online Instant Cash Offer Baseline in 2 Minutes',
    subtitle:
      'Never let a dealer lowball your trade-in by $3,000. Grab an online cash offer first so you know your exact walk-away floor.',
    ctaLabel: 'Check Instant Cash Value',
    badge: '2-Min Baseline',
    estimatedCpaUsd: 35,
    estimatedEpcUsd: 2.5,
    envKey: 'AFFILIATE_CASH_OFFER_URL',
    defaultUrl: 'https://www.carvana.com/sell-my-car',
    disclosure: 'Partner link — free valuation check with zero obligation to sell.',
  },
  {
    id: 'mobile-ppi',
    pillar: 'buy',
    category: 'Remote Used-Car Inspection',
    title: 'Order a Mobile Pre-Purchase Inspection (PPI) Anywhere in the US',
    subtitle:
      'Buying a used car from 200 miles away? Send an independent ASE mechanic to the lot for 60+ photos, OBD-II scan, and a road test before you wire a dime.',
    ctaLabel: 'Check Mobile Inspection Options',
    badge: 'Remote Buyer Shield',
    estimatedCpaUsd: 30,
    estimatedEpcUsd: 2.0,
    envKey: 'AFFILIATE_MOBILE_PPI_URL',
    defaultUrl: 'https://lemonsquad.com/',
    disclosure: 'Partner link — independent third-party vehicle inspection.',
  },
];

export function resolvePartnerUrl(partnerId: string, env: NodeJS.ProcessEnv = process.env): {
  offer: PartnerOffer;
  targetUrl: string;
} | null {
  const offer = PARTNER_OFFERS.find((p) => p.id === partnerId);
  if (!offer) return null;
  const custom = env[offer.envKey]?.trim();
  const targetUrl = custom && /^https?:\/\//i.test(custom) ? custom : offer.defaultUrl;
  return { offer, targetUrl };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'VantagePaths-Auto/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 100% Free Official US Government NHTSA VIN Decoder + Open Recalls + Owner Complaints.
 * Falls back cleanly to a realistic sample dossier if offline or NHTSA is unavailable.
 */
export async function lookupVinIntelligence(rawVin: string): Promise<VinIntelligenceResult> {
  const vin = rawVin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  if (vin.length !== 17) {
    throw new Error('Please enter a valid 17-character VIN (letters I, O, and Q are never used in VINs).');
  }

  try {
    const decodeUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(
      vin
    )}?format=json`;
    const decoded = await fetchJsonWithTimeout<{ Results?: Array<Record<string, string>> }>(
      decodeUrl,
      6000
    );
    const r = decoded.Results?.[0] || {};
    const year = (r.ModelYear || '').trim();
    const make = (r.Make || '').trim();
    const model = (r.Model || '').trim();

    if (!year || !make || !model) {
      throw new Error('VIN could not be decoded by NHTSA.');
    }

    const trim = (r.Trim || r.Series || 'Standard').trim();
    const bodyClass = (r.BodyClass || r.VehicleType || 'Passenger Vehicle').trim();
    const cyl = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : '';
    const disp = r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : '';
    const engineSummary = [disp, cyl, r.ElectrificationLevel || ''].filter(Boolean).join(' ').trim() || 'Factory Powertrain';
    const fuelType = (r.FuelTypePrimary || 'Gasoline').trim();
    const plantCountry = (r.PlantCountry || 'United States').trim();

    let recalls: VinIntelligenceResult['recalls'] = [];
    let complaintCount = 0;
    let topComplaintComponents: VinIntelligenceResult['topComplaintComponents'] = [];

    const [recRes, cmpRes] = await Promise.allSettled([
      fetchJsonWithTimeout<{ results?: Array<Record<string, string>> }>(
        `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
          make
        )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`,
        5000
      ),
      fetchJsonWithTimeout<{ results?: Array<Record<string, string>> }>(
        `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(
          make
        )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`,
        5000
      ),
    ]);

    if (recRes.status === 'fulfilled' && Array.isArray(recRes.value.results)) {
      recalls = recRes.value.results.slice(0, 6).map((rec) => ({
        campaignNumber: rec.NHTSACampaignNumber || 'N/A',
        component: rec.Component || 'Safety System',
        summary: (rec.Summary || '').slice(0, 260),
        remedy: (rec.Remedy || 'Free dealer recall repair under federal law.').slice(0, 220),
      }));
    }

    if (cmpRes.status === 'fulfilled' && Array.isArray(cmpRes.value.results)) {
      const list = cmpRes.value.results;
      complaintCount = list.length;
      const freq = new Map<string, number>();
      for (const c of list) {
        const comp = (c.components || 'General').split(',')[0].trim();
        freq.set(comp, (freq.get(comp) || 0) + 1);
      }
      topComplaintComponents = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([component, count]) => ({ component, count }));
    }

    const negotiationInsight =
      recalls.length > 0
        ? `NHTSA lists ${recalls.length} safety recall campaign(s) and ${complaintCount} owner complaint(s) for this ${year} ${make} ${model}. Demand written proof all recall remedies are completed BEFORE delivery, and use complaint hotspots during a Mobile PPI.`
        : `Zero open NHTSA recall campaigns found for this ${year} ${make} ${model} (${complaintCount} owner complaints logged). Skip overpriced $3,800 dealer warranties — if you want coverage, compare factory OEM plans online later for half the cost.`;

    return {
      vin,
      source: 'NHTSA_LIVE',
      year,
      make,
      model,
      trim,
      bodyClass,
      engineSummary,
      fuelType,
      plantCountry,
      recallCount: recalls.length,
      recalls,
      complaintCount,
      topComplaintComponents,
      negotiationInsight,
    };
  } catch {
    // Graceful offline / sandbox fallback so interactive demo never breaks
    return {
      vin,
      source: 'SAMPLE_FALLBACK',
      year: '2024',
      make: 'TOYOTA',
      model: 'RAV4 Hybrid',
      trim: 'XLE AWD',
      bodyClass: 'Sport Utility Vehicle (SUV)',
      engineSummary: '2.5L 4-cyl Hybrid',
      fuelType: 'Gasoline / Hybrid',
      plantCountry: 'UNITED STATES',
      recallCount: 1,
      recalls: [
        {
          campaignNumber: '24V-SAMPLE',
          component: 'ELECTRICAL SYSTEM / 12V BATTERY HOLD-DOWN',
          summary:
            'Sample offline NHTSA preview (live NHTSA lookup activates automatically when online). Always verify open recalls free at NHTSA.gov before signing.',
          remedy: 'Dealer must perform safety recall repairs at $0 cost before delivery.',
        },
      ],
      complaintCount: 28,
      topComplaintComponents: [
        { component: 'ELECTRICAL SYSTEM', count: 11 },
        { component: 'STRUCTURE / ROOF RAIL', count: 7 },
        { component: 'BRAKES / HYBRID REGEN', count: 5 },
      ],
      negotiationInsight:
        'Use decoded vehicle details to auto-fill your 5-dealer email bid-war, check state doc fee caps, and verify whether a factory OEM warranty is even needed.',
    };
  }
}

export interface LoanRescueInput extends AddOnRefundInput {
  currentLoanBalanceUsd: number;
  estimatedVehicleValueUsd: number;
  targetRefiAprPct: number;
}

export interface LoanRescueResult {
  refundEstimate: AddOnRefundEstimate;
  currentLtvPct: number;
  newLtvPct: number;
  ltvDropPct: number;
  currentlyRefiBlocked: boolean;
  unlockedRefiEligibility: boolean;
  currentMonthlyPaymentUsd: number;
  newRefiMonthlyPaymentUsd: number;
  monthlyPaymentSavingsUsd: number;
  refiInterestSavingsUsd: number;
  combinedTotalSavingsUsd: number;
  rescueHeadline: string;
}

function monthlyPmt(principal: number, aprPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r <= 0) return principal / months;
  return (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1);
}

/**
 * The Killer Wedge: 2-Step Car Loan Rescue!
 * Step 1: Cancel packed F&I add-ons -> drops principal & Loan-to-Value (LTV %)
 * Step 2: Unlocks Credit Union Auto Refinance -> slashes monthly payment & total interest!
 */
export function calculateLoanRescueLtv(
  input: LoanRescueInput,
  nowDate: Date = new Date()
): LoanRescueResult {
  const refundEstimate = calculateAddOnRefund(input, nowDate);
  const balance = Math.max(1000, Number(input.currentLoanBalanceUsd) || 38000);
  const carValue = Math.max(1000, Number(input.estimatedVehicleValueUsd) || 30000);
  const currentApr = Math.max(0.5, Number(input.loanAprPct) || 9.49);
  const targetRefiApr = Math.max(0.5, Number(input.targetRefiAprPct) || 5.99);
  const remainingMonths = Math.max(
    12,
    Math.round((Number(input.loanTermMonths) || 72) - refundEstimate.monthsElapsed)
  );

  const currentLtvPct = Math.round((balance / carValue) * 1000) / 10;
  const newBalance = Math.max(0, balance - refundEstimate.estimatedPrincipalRefundUsd);
  const newLtvPct = Math.round((newBalance / carValue) * 1000) / 10;
  const ltvDropPct = Math.round((currentLtvPct - newLtvPct) * 10) / 10;

  const currentlyRefiBlocked = currentLtvPct > 120;
  const unlockedRefiEligibility = currentlyRefiBlocked && newLtvPct <= 122;

  const currentMonthlyPaymentUsd = Math.round(monthlyPmt(balance, currentApr, remainingMonths));
  const newRefiMonthlyPaymentUsd = Math.round(monthlyPmt(newBalance, targetRefiApr, remainingMonths));
  const monthlyPaymentSavingsUsd = Math.max(0, currentMonthlyPaymentUsd - newRefiMonthlyPaymentUsd);

  const totalCurrentRemaining = currentMonthlyPaymentUsd * remainingMonths;
  const totalNewRemaining = newRefiMonthlyPaymentUsd * remainingMonths;
  const combinedTotalSavingsUsd = Math.max(
    refundEstimate.totalRecoverableValueUsd,
    Math.round(totalCurrentRemaining - totalNewRemaining)
  );
  const refiInterestSavingsUsd = Math.max(
    0,
    combinedTotalSavingsUsd - refundEstimate.totalRecoverableValueUsd
  );

  let rescueHeadline = `Cancel $${refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()} in add-ons + refinance to ${targetRefiApr}% to save $${monthlyPaymentSavingsUsd}/mo ($${combinedTotalSavingsUsd.toLocaleString()} total).`;
  if (unlockedRefiEligibility) {
    rescueHeadline = `BREAKTHROUGH: Your ${currentLtvPct}% LTV blocks most credit union refis today. Cancelling $${refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()} in F&I add-ons drops LTV to ${newLtvPct}% — unlocking refinancing & cutting your payment by ~$${monthlyPaymentSavingsUsd}/mo!`;
  }

  return {
    refundEstimate,
    currentLtvPct,
    newLtvPct,
    ltvDropPct,
    currentlyRefiBlocked,
    unlockedRefiEligibility,
    currentMonthlyPaymentUsd,
    newRefiMonthlyPaymentUsd,
    monthlyPaymentSavingsUsd,
    refiInterestSavingsUsd,
    combinedTotalSavingsUsd,
    rescueHeadline,
  };
}

export interface OutOfStateInput {
  homeStateCode: string;
  remoteStateCode: string;
  localDealerPriceUsd: number;
  localAddOnsUsd: number;
  remoteDealerPriceUsd: number;
  shippingOrFlightCostUsd: number;
}

export interface OutOfStateResult {
  homeStateName: string;
  remoteStateName: string;
  localDocFeeUsd: number;
  remoteDocFeeUsd: number;
  localOtdUsd: number;
  remoteAllInUsd: number;
  netSavingsUsd: number;
  winner: 'REMOTE_BUY' | 'LOCAL_BUY';
  taxRuleExplanation: string;
}

export function calculateOutOfStateSavings(input: OutOfStateInput): OutOfStateResult {
  const home = STATE_AUTO_RULES[input.homeStateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const remote = STATE_AUTO_RULES[input.remoteStateCode?.toUpperCase()] ?? STATE_AUTO_RULES.OH;
  const taxRate = home.typicalSalesTaxPct / 100;

  const localDocFeeUsd = home.docFeeCapUsd ?? home.typicalDocFeeUsd;
  const remoteDocFeeUsd = remote.docFeeCapUsd ?? remote.typicalDocFeeUsd;

  const localPrice = Math.max(0, Number(input.localDealerPriceUsd) || 0);
  const localAddOns = Math.max(0, Number(input.localAddOnsUsd) || 0);
  const remotePrice = Math.max(0, Number(input.remoteDealerPriceUsd) || 0);
  const shipping = Math.max(0, Number(input.shippingOrFlightCostUsd) || 0);

  // Key truth most buyers don't know: sales tax is ALWAYS based on HOME state registration!
  const localOtdUsd = Math.round((localPrice + localAddOns + localDocFeeUsd) * (1 + taxRate) + 325);
  const remoteAllInUsd = Math.round((remotePrice + remoteDocFeeUsd) * (1 + taxRate) + 325 + shipping);
  const netSavingsUsd = localOtdUsd - remoteAllInUsd;

  return {
    homeStateName: home.name,
    remoteStateName: remote.name,
    localDocFeeUsd,
    remoteDocFeeUsd,
    localOtdUsd,
    remoteAllInUsd,
    netSavingsUsd,
    winner: netSavingsUsd > 0 ? 'REMOTE_BUY' : 'LOCAL_BUY',
    taxRuleExplanation: `You NEVER pay double sales tax: you always pay ${home.name}'s ~${home.typicalSalesTaxPct}% tax where you register the car — while capturing ${remote.name}'s lower selling price & $${remoteDocFeeUsd} doc fee.`,
  };
}

export interface InsuranceAuditInput {
  stateCode: string;
  currentSixMonthPremiumUsd: number;
  priorSixMonthPremiumUsd: number;
  biPdLimits: string; // e.g., "100/300/100"
  collisionDeductibleUsd: number;
  compDeductibleUsd: number;
  hasRoadsideOnPolicy: boolean;
  hasRentalReimbursement: boolean;
  hasDealerGapCurrently: boolean;
  vehicleYmm?: string;
}

export interface InsuranceAuditResult {
  annualPremiumUsd: number;
  renewalHikePct: number;
  loyaltyPenaltyFlag: boolean;
  estimatedDeductibleAnnualSavingsUsd: number;
  deductibleBreakEvenMonths: number | null;
  estimatedAnnualTotalSavingsUsd: number;
  flags: Array<{ level: 'CRITICAL' | 'WARNING' | 'INFO'; title: string; detail: string }>;
  zeroSpamQuoteSpecText: string;
}

export function analyzeInsurancePolicy(input: InsuranceAuditInput): InsuranceAuditResult {
  const rule = STATE_AUTO_RULES[input.stateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const cur6 = Math.max(100, Number(input.currentSixMonthPremiumUsd) || 1180);
  const prev6 = Math.max(0, Number(input.priorSixMonthPremiumUsd) || cur6);
  const annualPremiumUsd = Math.round(cur6 * 2);
  const renewalHikePct = prev6 > 0 ? Math.round(((cur6 - prev6) / prev6) * 1000) / 10 : 0;
  const loyaltyPenaltyFlag = renewalHikePct >= 10;

  const colDed = Number(input.collisionDeductibleUsd) || 500;
  const estimatedDeductibleAnnualSavingsUsd =
    colDed <= 250 ? Math.round(annualPremiumUsd * 0.16) : colDed <= 500 ? Math.round(annualPremiumUsd * 0.11) : 0;
  const deductibleJump = colDed < 1000 ? 1000 - colDed : 0;
  const deductibleBreakEvenMonths =
    estimatedDeductibleAnnualSavingsUsd > 0 && deductibleJump > 0
      ? Math.round((deductibleJump / estimatedDeductibleAnnualSavingsUsd) * 12)
      : null;

  const flags: InsuranceAuditResult['flags'] = [];

  if (loyaltyPenaltyFlag) {
    flags.push({
      level: 'CRITICAL',
      title: `Renewal Loyalty Penalty Detected (+${renewalHikePct}% Jump)`,
      detail: `Your 6-month rate jumped from $${prev6.toLocaleString()} to $${cur6.toLocaleString()}. Insurers systematically raise rates on loyal customers who don't re-shop every 12–18 months — reshopping apples-to-apples typically recovers 15%–28%.`,
    });
  }

  if (colDed <= 500) {
    flags.push({
      level: 'WARNING',
      title: `Low $${colDed} Collision Deductible Costs ~$${estimatedDeductibleAnnualSavingsUsd}/yr Extra`,
      detail: `Raising collision deductible from $${colDed} to $1,000 saves ~$${estimatedDeductibleAnnualSavingsUsd}/yr — paying for the extra $${deductibleJump} deductible in ~${deductibleBreakEvenMonths} claim-free months.`,
    });
  }

  if (input.hasRoadsideOnPolicy) {
    flags.push({
      level: 'WARNING',
      title: 'Warning: Insurance Roadside Assistance Claims Can Trigger Surcharges',
      detail:
        'Using insurer roadside towing frequently logs on your CLUE report as a claim and raises renewal rates! Use AAA (~$65/yr) or credit card roadside instead and drop carrier roadside.',
    });
  }

  if (input.hasDealerGapCurrently) {
    flags.push({
      level: 'CRITICAL',
      title: 'Replace $1,000+ Dealer GAP With ~$40–$80/yr Insurer Loan/Lease Payoff',
      detail:
        'Ask your insurer to add Loan/Lease Payoff coverage (~$5/mo), then cancel your overpriced dealership GAP waiver in Pillar 2 for a cash/principal refund!',
    });
  }

  if (input.biPdLimits === '25/50/25' || input.biPdLimits === '30/60/25') {
    flags.push({
      level: 'WARNING',
      title: `State-Minimum Liability (${input.biPdLimits}) Leaves Your Assets Exposed`,
      detail:
        'One moderate SUV accident easily exceeds $25k property damage. Upgrading to 100/300/100 typically costs only $8–$15/mo more when re-shopped properly.',
    });
  }

  const reShopSavings = Math.round(annualPremiumUsd * (loyaltyPenaltyFlag ? 0.2 : 0.12));
  const estimatedAnnualTotalSavingsUsd =
    reShopSavings + (colDed <= 500 ? Math.round(estimatedDeductibleAnnualSavingsUsd * 0.5) : 0);

  const zeroSpamQuoteSpecText = `Subject: Apples-to-Apples Auto Insurance Quote Request (Email Only — No Phone Calls)

Hi [Independent Insurance Agent],

I am re-shopping my ${rule.name} auto insurance policy for my ${
    input.vehicleYmm?.trim() || '[Year Make Model]'
  } and would like a clean, apples-to-apples quote by email only. Please quote these EXACT coverages so I can compare accurately:

- Bodily Injury / Property Damage Liability: ${input.biPdLimits} (also quote 100/300/100 if different)
- Uninsured / Underinsured Motorist (UM/UIM): Match Liability Limits
- Comprehensive Deductible: $${input.compDeductibleUsd}
- Collision Deductible: $1,000 (and compare vs $${colDed})
- Roadside Assistance: EXCLUDE (avoid CLUE towing claims)
- Rental Reimbursement: ${input.hasRentalReimbursement ? '$40/day ($1,200 max)' : 'EXCLUDE'}
- Loan/Lease Payoff (GAP): ${input.hasDealerGapCurrently ? 'INCLUDE (replacing dealership GAP)' : 'Not needed'}

Current 6-month renewal benchmark: $${cur6.toLocaleString()}. Please reply with your itemized 6-month and 12-month quotes and available multi-policy / autopay / paid-in-full discounts.

Thank you,
[Your Name]`;

  return {
    annualPremiumUsd,
    renewalHikePct,
    loyaltyPenaltyFlag,
    estimatedDeductibleAnnualSavingsUsd,
    deductibleBreakEvenMonths,
    estimatedAnnualTotalSavingsUsd,
    flags,
    zeroSpamQuoteSpecText,
  };
}

export interface SellExitInput {
  stateCode: string;
  dealerTradeInOfferUsd: number;
  instantCashOfferUsd: number;
  privatePartyValueUsd: number;
  loanPayoffUsd: number;
  buyingReplacementCar: boolean;
}

export interface SellExitResult {
  stateName: string;
  tradeInTaxCreditApplies: boolean;
  tradeInTaxSavingsUsd: number;
  dealerTradeEffectiveUsd: number;
  instantCashEffectiveUsd: number;
  privatePartyEffectiveUsd: number;
  privateBreakEvenOverTradeUsd: number;
  bestPath: 'DEALER_TRADE' | 'INSTANT_CASH' | 'PRIVATE_SALE';
  advantageOverWorstUsd: number;
  netCashAfterPayoffUsd: number;
  recommendation: string;
}

export function calculateSellExitPaths(input: SellExitInput): SellExitResult {
  const rule = STATE_AUTO_RULES[input.stateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const dealerTrade = Math.max(0, Number(input.dealerTradeInOfferUsd) || 0);
  const instantCash = Math.max(0, Number(input.instantCashOfferUsd) || 0);
  const privateVal = Math.max(0, Number(input.privatePartyValueUsd) || 0);
  const payoff = Math.max(0, Number(input.loanPayoffUsd) || 0);
  const taxRate = rule.typicalSalesTaxPct / 100;

  const tradeInTaxSavingsUsd =
    input.buyingReplacementCar && rule.tradeInTaxCredit ? Math.round(dealerTrade * taxRate) : 0;
  const dealerTradeEffectiveUsd = Math.round(dealerTrade + tradeInTaxSavingsUsd);
  const instantCashEffectiveUsd = Math.round(instantCash);
  const privatePartyEffectiveUsd = Math.round(privateVal);

  const scores = [
    { key: 'DEALER_TRADE' as const, val: dealerTradeEffectiveUsd },
    { key: 'INSTANT_CASH' as const, val: instantCashEffectiveUsd },
    { key: 'PRIVATE_SALE' as const, val: privatePartyEffectiveUsd },
  ].sort((a, b) => b.val - a.val);

  const bestPath = scores[0].key;
  const advantageOverWorstUsd = Math.max(0, scores[0].val - scores[2].val);
  const netCashAfterPayoffUsd = scores[0].val - payoff;

  let recommendation = '';
  if (bestPath === 'PRIVATE_SALE') {
    recommendation = `Selling privately beats trading in by $${(
      privatePartyEffectiveUsd - dealerTradeEffectiveUsd
    ).toLocaleString()} (even after ${rule.name}'s $${tradeInTaxSavingsUsd.toLocaleString()} trade-in tax credit). Use our bank-verified cashier's check safety checklist below.`;
  } else if (bestPath === 'INSTANT_CASH') {
    recommendation = `Taking the Instant Cash Offer ($${instantCash.toLocaleString()}) beats the dealer's effective trade-in value ($${dealerTradeEffectiveUsd.toLocaleString()}) with ZERO private-buyer hassle — OR show the cash offer to the dealer and make them match it!`;
  } else {
    recommendation = `Trading in at the dealer WINS in ${rule.name}! Your $${tradeInTaxSavingsUsd.toLocaleString()} sales tax credit pushes effective trade value to $${dealerTradeEffectiveUsd.toLocaleString()} — a private buyer would have to pay over $${dealerTradeEffectiveUsd.toLocaleString()} just to tie.`;
  }

  return {
    stateName: rule.name,
    tradeInTaxCreditApplies: rule.tradeInTaxCredit,
    tradeInTaxSavingsUsd,
    dealerTradeEffectiveUsd,
    instantCashEffectiveUsd,
    privatePartyEffectiveUsd,
    privateBreakEvenOverTradeUsd: dealerTradeEffectiveUsd,
    bestPath,
    advantageOverWorstUsd,
    netCashAfterPayoffUsd,
    recommendation,
  };
}
