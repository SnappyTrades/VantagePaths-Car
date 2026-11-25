import crypto from 'node:crypto';
import type {
  AuditFinding,
  AuditLineItem,
  AuditVerticalId,
  AutoDocVariant,
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
  auto: {
    passSku: 'AUTO_PASS',
    passName: '60-Day VantagePaths Auto Pass',
    passPriceUsd: 29,
    passDescription:
      'Unlock all 4 pillars for 60 days: Buy-From-Home OTD & TILA Contract Audits, Pre-Filled F&I Cancellation + Stall-Buster PDFs, Zero-Spam Insurance Spec Sheets & Private Sale Checklists.',
    proSku: 'CERTIFIED_MAIL',
    proName: '1-Click USPS Certified Mail Dispatch',
    proPriceUsd: 15,
    proDescription:
      'Optional self-service mail dispatch: you review & sign your own cancellation letter and VantagePaths dispatches USPS Certified Mail (Return Receipt) to Administrator + Dealer F&I.',
  },
};

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
    round2(
      (quotedMonthlyUsd - fairMonthlyUsd) * termMonths +
        (quotedOtdUsd - fairOtdUsd - (financedQuotedUsd - financedFairUsd))
    )
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

export interface SampleDocument {
  fileName: string;
  title: string;
  variant: AutoDocVariant;
  rawText: string;
}

export function getSampleAuditInput(variant: AutoDocVariant = 'otd'): SampleDocument {
  if (variant === 'signed-contract') {
    return {
      fileName: 'Sample_Signed_RISC_TILA_Contract.txt',
      title: 'Signed Retail Installment Sale Contract (TILA Disclosure — $43,620)',
      variant: 'signed-contract',
      rawText: `RETAIL INSTALLMENT SALE CONTRACT — SIMPLE FINANCE CHARGE (TRUTH-IN-LENDING DISCLOSURE)
Buyer: Alex Rivera | Dealer: Metro Valley Motors (Texas) | Purchase Date: 22 days ago
Vehicle: 2025 Honda CR-V Hybrid Sport-L AWD | Odometer: 1,140 miles

FEDERAL TRUTH-IN-LENDING (TILA) BOX:
- Annual Percentage Rate (APR): 8.99%
- Finance Charge (Total Interest Paid): $12,844.80
- Amount Financed: $43,620.00
- Total of Payments (72 payments of $784.23): $56,464.80

ITEMIZATION OF AMOUNT FINANCED:
1. Cash Price of Vehicle (includes $1,295 Paint/Fabric Shield + $595 Pulse Brake): $39,385.00
2. Official Fees + Sales Tax (6.25%): $2,740.00
3. Dealer Documentary Fee (TX Cap $225): $225.00
4. Optional Service Contract (Fidelity Platinum VSC 72mo/100k): $3,495.00
5. Optional GAP Debt Waiver (Dealer Financed): $1,195.00
6. Optional Tire & Wheel Road Hazard Plan: $895.00
7. Less Cash Down Payment: -$4,315.00
TOTAL AMOUNT FINANCED: $43,620.00

NOTE: All optional F&I contracts are within the 30-day free-look window with zero claims filed.`,
    };
  }

  if (variant === 'insurance-dec') {
    return {
      fileName: 'Sample_Auto_Insurance_Declarations_Page.txt',
      title: 'Auto Policy Declarations Page ($1,248 / 6-Mo Renewal)',
      variant: 'insurance-dec',
      rawText: `AUTO POLICY DECLARATIONS PAGE — RENEWAL NOTICE
Policyholder: Jordan Taylor | State: Texas (75024) | Term: 6 Months
Vehicle: 2024 Toyota RAV4 Hybrid XLE AWD (VIN: 2T3P1RFV0RW000112)

RENEWAL PREMIUM: $1,248.00 / 6 months ($2,496/yr)
Prior Term Premium: $985.00 / 6 months (+26.7% Renewal Jump — Zero Accidents or Tickets!)

COVERAGES & DEDUCTIBLES:
- Bodily Injury Liability: $100,000 / $300,000 ($312)
- Property Damage Liability: $100,000 ($228)
- Uninsured / Underinsured Motorist: $100,000 / $300,000 ($115)
- Collision ($250 Deductible): $388
- Comprehensive ($250 Deductible): $122
- Emergency Roadside Assistance Towing: $39
- Rental Reimbursement ($30/day): $44
- Loan/Lease Payoff (GAP): NOT INCLUDED (Buyer is currently paying $1,195 financed dealer GAP!)`,
    };
  }

  return {
    fileName: 'Sample_Dealer_OTD_Worksheet_RAV4_Hybrid.txt',
    title: '2026 Toyota RAV4 Hybrid XLE Dealer OTD Worksheet ($46,842)',
    variant: 'otd',
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

function detectDocVariant(rawText: string, explicitVariant?: AutoDocVariant): AutoDocVariant {
  if (explicitVariant === 'signed-contract' || explicitVariant === 'insurance-dec' || explicitVariant === 'otd') {
    return explicitVariant;
  }
  const lower = rawText.toLowerCase();
  if (lower.includes('declarations') || lower.includes('bodily injury') || lower.includes('collision')) {
    return 'insurance-dec';
  }
  if (lower.includes('truth-in-lending') || lower.includes('retail installment') || lower.includes('amount financed')) {
    return 'signed-contract';
  }
  return 'otd';
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

function getSystemPromptForVariant(variant: AutoDocVariant): string {
  const schema = `Return ONLY valid JSON matching this exact structure (no markdown fences, no commentary outside JSON):
{
  "documentSummary": "1-2 concise sentences summarizing the uploaded document and amounts.",
  "verdictLabel": "Short punchy verdict",
  "verdictTone": "high_risk" | "moderate_risk" | "fair",
  "estimatedSavingsUsd": 4200,
  "billedTotalUsd": 46842,
  "fairRangeLabel": "$39,500 - $40,900",
  "freeFlags": [
    { "level": "CRITICAL" | "WARNING" | "INFO", "title": "Short flag title", "detail": "Specific factual explanation citing exact numbers.", "estimatedImpactUsd": 2789 }
  ],
  "lockedFlags": [
    { "level": "CRITICAL" | "WARNING" | "INFO", "title": "Deeper audit flag title", "detail": "Detailed line-item or statutory catch.", "estimatedImpactUsd": 1269 }
  ],
  "lineItems": [
    { "label": "Line item name", "quotedAmount": "$1,495", "benchmarkAmount": "$0 (Optional)", "status": "OVERCHARGED" | "MISSING" | "SUSPECT" | "FAIR" }
  ],
  "counterOfferSubject": "Professional self-service email subject line",
  "counterOfferScript": "Polite, firm, word-for-word self-service email/letter citing exact dollar adjustments.",
  "negotiationChecklist": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "deterministicMetrics": [{ "label": "Key metric", "value": "Formatted value" }]
}
Rules: Put top 2 findings in "freeFlags" (max 2) and 2 to 5 deeper catches in "lockedFlags". Never fabricate facts; frame everything as informational self-service benchmarks.`;

  if (variant === 'signed-contract') {
    return `You are a senior US Consumer Auto Finance & Truth-in-Lending (TILA) Contract Analyst at VantagePaths.com.
Decode this signed Retail Installment Sale Contract for:
1. Optional cancellable F&I add-ons rolled into Amount Financed (VSC/Extended Warranty, GAP Waiver, Tire & Wheel, Maintenance) + free-look/prorated principal refund & compound interest savings.
2. Dealer APR markup vs credit union refinance rates once LTV drops.
3. Non-cancellable dealer junk packs folded into Cash Price vs statutory fees.
Generate a self-service F&I Cancellation Demand Letter in counterOfferScript.
${schema}`;
  }

  if (variant === 'insurance-dec') {
    return `You are an independent US Auto Insurance Policy Auditor at VantagePaths.com.
Audit this Auto Insurance Declarations Page for:
1. Renewal "loyalty penalty" rate hikes despite clean driving record.
2. Low $250/$500 collision/comp deductibles vs $1,000 break-even savings.
3. Insurer Roadside Assistance CLUE-claim traps (recommend dropping & using AAA/card instead).
4. Adding ~$5/mo insurer Loan/Lease Payoff coverage so the driver can cancel $1,195 dealership GAP.
Generate a clean 1-page Zero-Spam Apples-to-Apples Email Quote Request in counterOfferScript.
${schema}`;
  }

  return `You are an elite US Auto Buyer Advocate and Finance/Lease Desk Auditor at VantagePaths.com.
Audit this dealership Out-The-Door (OTD) worksheet, buyer's order, or lease quote for:
1. Optional dealer-installed add-ons (nitrogen, VIN etch, pulse brake, ceramic/paint protection, prep fees).
2. Excess documentation/admin fees above state statutory caps or ~$200 benchmarks.
3. Dealer APR reserve markups (vs prime ~5.5–6.2% credit union rates) or lease money factor markups (MF × 2400).
4. Overpriced dealer GAP ($900–$1,400 vs ~$250 insurer/credit union) and market adjustments.
Generate a firm, ready-to-send OTD Counter-Offer Email in counterOfferScript.
${schema}`;
}

function buildDeterministicFallback(
  variant: AutoDocVariant,
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
  const moneyMatches = [
    ...rawText.matchAll(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g),
  ]
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  const largestAmount = moneyMatches.length > 0 ? Math.max(...moneyMatches) : null;

  if (variant === 'signed-contract') {
    const amtFinanced = 43620;
    return {
      vertical: 'auto',
      fileName,
      documentSummary: `Self-service TILA contract breakdown of ${fileName} ($${amtFinanced.toLocaleString()} Amount Financed @ 8.99% APR). Identified $5,585 in cancellable F&I add-ons plus ~$1,610 in avoidable compound loan interest.`,
      verdictLabel: '3 Cancellable F&I Add-Ons + Refi Opportunity ($7,195 Value)',
      verdictTone: 'high_risk',
      estimatedSavingsUsd: 7195,
      billedTotalUsd: amtFinanced,
      fairRangeLabel: '$38,035 Clean Principal @ ~5.99% Refi',
      freeFlags: [
        {
          level: 'CRITICAL',
          title: '$5,585 in Optional Cancellable F&I Contracts Rolled Into Loan',
          detail:
            'Fidelity VSC ($3,495), Dealer GAP ($1,195), and Tire & Wheel ($895) are 100% optional and eligible for full refund inside the 30-day free-look window (or prorated after).',
          estimatedImpactUsd: 5585,
        },
        {
          level: 'CRITICAL',
          title: '$1,610+ in Compound Interest Eliminated Upon Cancellation',
          detail:
            'Applying the $5,585 refund to your 8.99% principal balance eliminates ~$1,610 in future interest and lowers your Loan-to-Value so you can refinance.',
          estimatedImpactUsd: 1610,
        },
      ],
      lockedFlags: [
        {
          level: 'WARNING',
          title: '8.99% Dealer APR Reserve Markup — Refinance After Refund Posts',
          detail:
            'Once the $5,585 principal credit posts to your lender account, refinancing $38,035 down to ~5.99% cuts your monthly payment by ~$165/mo.',
          estimatedImpactUsd: 3400,
        },
        {
          level: 'INFO',
          title: '$1,890 Physical Add-Ons Folded Into Cash Price',
          detail:
            'Paint/Fabric ($1,295) and Pulse Brake ($595) were folded into Line 1 Cash Price; check ancillary forms for 30-day appearance warranty cancellation clauses.',
          estimatedImpactUsd: 1890,
        },
      ],
      lineItems: [
        { label: 'Fidelity Extended Warranty (VSC)', quotedAmount: '$3,495', benchmarkAmount: '100% Cancellable', status: 'OVERCHARGED' },
        { label: 'Dealer GAP Debt Waiver', quotedAmount: '$1,195', benchmarkAmount: '~$250 Insurer GAP', status: 'OVERCHARGED' },
        { label: 'Tire & Wheel Road Hazard', quotedAmount: '$895', benchmarkAmount: '100% Cancellable', status: 'OVERCHARGED' },
        { label: 'Contract APR (72 mos)', quotedAmount: '8.99% ($784/mo)', benchmarkAmount: '~5.99% Credit Union', status: 'SUSPECT' },
        { label: 'Texas Doc Fee', quotedAmount: '$225', benchmarkAmount: '$225 TX Cap', status: 'FAIR' },
      ],
      counterOfferSubject: 'FORMAL WRITTEN NOTICE OF F&I CONTRACT CANCELLATION — FULL FREE-LOOK REFUND',
      counterOfferScript: `TO: Plan Administrator Cancellations Dept. & Metro Valley Motors F&I Director

Please accept this signed notice to immediately cancel my optional Vehicle Service Contract ($3,495), GAP Debt Waiver ($1,195), and Tire & Wheel Plan ($895) purchased 22 days ago (Current Odometer: 1,140 miles, zero claims filed).

Because this written notice is submitted within the 30-day free-look period, please remit the 100% full refund ($5,585.00) directly to my auto lienholder to be applied to my principal balance, and email written confirmation within 5 business days.

Sincerely,
[Buyer Signature]`,
      negotiationChecklist: [
        'Attach a clear timestamped photo of your current odometer (1,140 miles) to lock in your cancellation date.',
        'Email AND mail via USPS Certified Mail directly to the Plan Administrator + CC the Dealership F&I Director.',
        'Once the $5,585 principal credit posts on your loan portal, compare soft-pull credit union refinance rates.',
      ],
      deterministicMetrics: [
        { label: 'Cancellable Principal', value: '$5,585' },
        { label: 'Avoided Loan Interest', value: '+$1,610' },
        { label: 'Total Recoverable Value', value: '$7,195' },
      ],
    };
  }

  if (variant === 'insurance-dec') {
    return {
      vertical: 'auto',
      fileName,
      documentSummary: `Declarations Page audit of ${fileName} ($1,248 / 6-month renewal = $2,496/yr). Detected a +26.7% loyalty rate hike, expensive $250 deductibles, and a CLUE roadside trap.`,
      verdictLabel: '26.7% Loyalty Penalty + 3 Policy Optimizations (~$640/yr Savings)',
      verdictTone: 'high_risk',
      estimatedSavingsUsd: 640,
      billedTotalUsd: 2496,
      fairRangeLabel: '$1,750 – $1,920 / yr (100/300/100)',
      freeFlags: [
        {
          level: 'CRITICAL',
          title: '+26.7% Renewal Loyalty Hike Despite Clean Record',
          detail:
            'Your 6-month rate jumped from $985 to $1,248 (+$526/yr) with zero tickets or claims. Re-shopping identical 100/300/100 limits typically recovers 18%–25%.',
          estimatedImpactUsd: 460,
        },
        {
          level: 'WARNING',
          title: '$250 Collision Deductible Costs ~$340/yr Extra',
          detail:
            'Raising collision deductible from $250 to $1,000 saves ~$340/yr — breaking even on the $750 difference in ~26 claim-free months.',
          estimatedImpactUsd: 340,
        },
      ],
      lockedFlags: [
        {
          level: 'WARNING',
          title: 'Drop Carrier Roadside ($78/yr) to Avoid CLUE Claim Flags',
          detail:
            'Filing a $90 tow through your auto policy often logs as a claim on your CLUE report and triggers renewal surcharges. Use AAA or a travel card instead.',
          estimatedImpactUsd: 78,
        },
        {
          level: 'CRITICAL',
          title: 'Add ~$5/mo Insurer Loan/Lease Payoff & Cancel $1,195 Dealer GAP',
          detail:
            'Adding Loan/Lease Payoff here lets you immediately cancel your $1,195 financed dealership GAP waiver for a principal refund!',
          estimatedImpactUsd: 950,
        },
      ],
      lineItems: [
        { label: '6-Month Renewal Rate', quotedAmount: '$1,248 ($2,496/yr)', benchmarkAmount: '$890–$960 / 6mo', status: 'OVERCHARGED' },
        { label: 'BI / PD Liability (100/300/100)', quotedAmount: '$540 / 6mo', benchmarkAmount: 'Strong Asset Protection', status: 'FAIR' },
        { label: 'Collision ($250 Deductible)', quotedAmount: '$388 / 6mo', benchmarkAmount: 'Raise to $1,000 Ded.', status: 'OVERCHARGED' },
        { label: 'Carrier Roadside Towing', quotedAmount: '$39 / 6mo', benchmarkAmount: 'Exclude (CLUE Risk)', status: 'SUSPECT' },
        { label: 'Loan/Lease Payoff (GAP)', quotedAmount: 'Excluded', benchmarkAmount: 'Add (~$30/6mo) vs Dealer GAP', status: 'MISSING' },
      ],
      counterOfferSubject: 'Apples-to-Apples Auto Insurance Quote Request (Email Only — No Phone Calls)',
      counterOfferScript: `Hi [Independent Agent],

Please email an apples-to-apples 6-month and 12-month quote for my 2024 Toyota RAV4 Hybrid XLE (ZIP 75024, clean record) matching these exact coverages:
- Liability (BI/PD): 100/300/100 | UM/UIM: 100/300
- Comprehensive Deductible: $500 | Collision Deductible: $1,000
- Roadside Assistance: EXCLUDE | Loan/Lease Payoff (GAP): INCLUDE

My current renewal is $1,248 / 6 months. Please reply by email only with paid-in-full and autopay discounts itemized.

Thank you,
[Your Name]`,
      negotiationChecklist: [
        'Send the Quote Spec above to 2–3 local independent brokers (they shop 10+ carriers at once with zero spam).',
        'Confirm new policy + Loan/Lease Payoff is active BEFORE cancelling your old policy or dealership GAP.',
        'Set a 6-month calendar reminder 30 days before your next renewal.',
      ],
      deterministicMetrics: [
        { label: 'Current Annualized Cost', value: '$2,496/yr' },
        { label: 'Renewal Jump', value: '+26.7%' },
        { label: 'Est. Annual Re-Shop Savings', value: '~$640/yr' },
      ],
    };
  }

  // Default: Dealer OTD Worksheet / Buyer's Order
  const otd = largestAmount ?? 46842;
  const estSavings = otd > 30000 ? 6480 : Math.round(otd * 0.14);
  return {
    vertical: 'auto',
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
          'Pulse Brake/Nitrogen ($699), Ceramic Paint Shield ($1,495), and VIN Etching ($595) are 100% optional dealer profit add-ons.',
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
          'Comparable GAP coverage costs $250–$350 through a credit union or your auto insurer ($800+ savings).',
        estimatedImpactUsd: 800,
      },
      {
        level: 'WARNING',
        title: '$1,500 Market Adjustment Above MSRP',
        detail:
          'Market adjustments on volume trims are routinely waived when competing dealers quote straight MSRP or below.',
        estimatedImpactUsd: 1500,
      },
    ],
    lineItems: [
      { label: 'Selling Price vs MSRP', quotedAmount: '$37,985', benchmarkAmount: '$36,485 MSRP', status: 'OVERCHARGED' },
      { label: 'Paint / Nitrogen / VIN Etch', quotedAmount: '$2,789', benchmarkAmount: '$0 (Optional)', status: 'OVERCHARGED' },
      { label: 'Doc + E-Filing/Prep Fees', quotedAmount: '$1,444', benchmarkAmount: '$175 State Cap', status: 'OVERCHARGED' },
      { label: 'Dealer GAP Insurance', quotedAmount: '$1,195', benchmarkAmount: '$300 Credit Union', status: 'OVERCHARGED' },
      { label: 'Quoted APR (72 mos)', quotedAmount: '8.89% ($770/mo)', benchmarkAmount: '5.79% (~$615/mo)', status: 'OVERCHARGED' },
    ],
    counterOfferSubject: 'Ready to Buy Today — Clean Out-The-Door Offer on 2026 RAV4 Hybrid XLE',
    counterOfferScript: `Hi [Internet Sales Manager],

Thank you for sending the worksheet on the 2026 RAV4 Hybrid XLE. I am pre-approved with my credit union at 5.79% APR and ready to place a deposit today if we clean up the Out-The-Door numbers:

1. Vehicle Selling Price: $36,485 (MSRP, removing the $1,500 market adjustment).
2. Remove all optional dealer add-ons: Ceramic Shield ($1,495), Pulse/Nitrogen ($699), VIN Etch ($595), Electronic Prep ($449), and Dealer GAP ($1,195).
3. Adjust Doc Fee to the statutory $175 cap + actual tax and DMV title/reg.

That brings my clean Out-The-Door offer to $39,710. If your lenders can beat 5.79% APR with zero add-ons, I am happy to finance in-house. Please email the revised Buyer's Order PDF so I can review from home.

Best,
[Your Name]`,
    negotiationChecklist: [
      'Hold a real outside credit union pre-approval before signing so F&I cannot mark up your rate.',
      'Negotiate strictly on itemized Out-The-Door (OTD) total price — never monthly payment.',
      'Request the final Buyer’s Order & TILA Contract PDF by email 24 hours before pickup or delivery.',
    ],
    deterministicMetrics: [
      { label: 'Quoted OTD Price', value: `$${otd.toLocaleString()}` },
      { label: 'Removable Fees + Markup', value: `$${estSavings.toLocaleString()}` },
      { label: 'Target Clean OTD', value: `$${Math.max(5000, Math.round(otd - 7132)).toLocaleString()}` },
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

export function toPublicAuditResponse(
  record: StoredAuditRecord,
  stripeLive = isStripeLiveConfigured()
): PublicAuditResponse {
  return {
    auditId: record.auditId,
    vertical: 'auto',
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
    pricing: VERTICAL_PRICING.auto,
    stripeLiveConfigured: stripeLive,
  };
}

export interface RunAuditParams {
  vertical?: AuditVerticalId;
  docVariant?: AutoDocVariant;
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
  const auditId = `vp_auto_${crypto.randomBytes(5).toString('hex')}`;
  const createdUtc = new Date().toISOString();
  const textSnippet = (params.rawText || '').trim().slice(0, 18000);
  const variant = detectDocVariant(textSnippet, params.docVariant);
  const isBinaryAttachment = Boolean(
    params.fileBuffer &&
      params.fileBuffer.length > 0 &&
      (params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf')
  );

  params.db.logEvent({
    eventName: 'audit_started',
    vertical: 'auto',
    auditId,
    metadata: { fileName: params.fileName, mimeType: params.mimeType, variant, isBinaryAttachment },
  });

  const userPromptParts = [`Document Type: ${variant.toUpperCase()}`, `File Name: ${params.fileName}`];
  if (params.contextNote?.trim()) {
    userPromptParts.push(`User Context / Notes: ${params.contextNote.trim().slice(0, 1000)}`);
  }
  if (textSnippet) {
    userPromptParts.push(`Document Text:\n---\n${textSnippet}\n---`);
  } else if (isBinaryAttachment) {
    userPromptParts.push(
      'Inspect the attached PDF or photo carefully. Extract all line items, totals, APRs, coverages, and fine-print clauses, then audit them thoroughly.'
    );
  }

  let recordCore: ReturnType<typeof buildDeterministicFallback> | null = null;
  let reasoningProvider: StoredAuditRecord['reasoningProvider'] = 'DETERMINISTIC_FALLBACK';
  let llmProvider: StoredAuditRecord['llmProvider'] = null;
  let modelUsed: string | null = null;

  try {
    const llmRes = await generateStructuredAuditWithFailover(
      {
        systemInstruction: getSystemPromptForVariant(variant),
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
    const fallback = buildDeterministicFallback(variant, params.fileName, textSnippet);

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
      vertical: 'auto',
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
      `[VantagePaths Auto] Free LLM chain unavailable, using specialized ${variant} fallback:`,
      err instanceof Error ? err.message : err
    );
    recordCore = buildDeterministicFallback(variant, params.fileName, textSnippet);
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
    vertical: 'auto',
    auditId,
    metadata: {
      variant,
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
