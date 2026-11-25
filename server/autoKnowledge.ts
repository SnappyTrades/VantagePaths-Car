export type LegalRequirementStatus = 'REQUIRED' | 'OPTIONAL' | 'CONDITIONAL';
export type CancellableStatus = 'YES_FULL_OR_PRORATED' | 'PARTIAL_OR_DISPUTABLE' | 'NO';

export interface AutoAddOnItem {
  id: string;
  name: string;
  shortLabel: string;
  category: 'STATUTORY' | 'DEALER_FEE' | 'FI_ADDON' | 'LEASE_FEE';
  legallyRequired: LegalRequirementStatus;
  typicalDealerPrice: string;
  realMarketCost: string;
  cancellableAfterPurchase: CancellableStatus;
  plainEnglish: string;
  dealerPitch: string;
  yourRebuttal: string;
  cancellationNotes: string;
}

export interface StateAutoRule {
  code: string;
  name: string;
  docFeeCapUsd: number | null; // null = no statutory cap
  typicalDocFeeUsd: number;
  tradeInTaxCredit: boolean;
  typicalSalesTaxPct: number;
  vscFreeLookDays: number;
  vscMaxAdminFeeUsd: number;
  notes: string;
}

export interface FiAdministratorInfo {
  id: string;
  name: string;
  products: string;
  freeLookWindow: string;
  cancellationAddress: string;
  directBypassTip: string;
  requiredDocs: string[];
  contactHint: string;
}

export interface ConsumerProtectionResource {
  name: string;
  role: string;
  whenToUse: string;
  url: string;
}

export interface FourSquareInput {
  vehiclePriceUsd: number;
  downOrTradeUsd: number;
  salesTaxPct: number;
  titleRegDocUsd: number;
  termMonths: number;
  dealerQuotedMonthlyUsd: number;
  expectedFairAprPct: number;
}

export interface FourSquareResult {
  fairAmountFinancedUsd: number;
  fairMonthlyUsd: number;
  monthlyOverchargeUsd: number;
  totalPaymentGapUsd: number;
  impliedPrincipalAtFairAprUsd: number;
  hiddenMarkupEstimateUsd: number;
  impliedAprAtFairPricePct: number | null;
  verdict: 'CLEAN' | 'SUSPICIOUS_MARKUP' | 'HEAVY_PACKING';
  explanation: string;
}

export interface PathCompareInput {
  vehiclePriceUsd: number;
  downPaymentUsd: number;
  tradeInValueUsd: number;
  tradeInPayoffUsd: number;
  stateCode: string;
  termMonths: number;
  promoAprPct: number;
  cashRebateUsd: number;
  creditUnionAprPct: number;
}

export interface PathCompareResult {
  stateName: string;
  tradeInTaxSavingsUsd: number;
  privateSaleBreakEvenUsd: number;
  promoPath: {
    amountFinancedUsd: number;
    monthlyUsd: number;
    totalInterestUsd: number;
    totalCostUsd: number;
  };
  rebatePath: {
    amountFinancedUsd: number;
    monthlyUsd: number;
    totalInterestUsd: number;
    totalCostUsd: number;
  };
  winner: 'PROMO_APR' | 'CASH_REBATE' | 'TIE';
  advantageUsd: number;
  summary: string;
}

export interface AddOnRefundItemInput {
  type: 'vsc' | 'gap' | 'tire_wheel' | 'maintenance' | 'paint_fabric' | 'theft_key';
  label: string;
  costUsd: number;
  contractTermMonths: number;
}

export interface AddOnRefundInput {
  purchaseDateIso: string;
  stateCode: string;
  financedInLoan: boolean;
  loanAprPct: number;
  loanTermMonths: number;
  currentMileage: number;
  purchaseMileage: number;
  claimsFiled: boolean;
  items: AddOnRefundItemInput[];
  // Optional metadata for pre-filled letters
  buyerName?: string;
  dealerName?: string;
  lenderName?: string;
  administratorName?: string;
  vehicleYmm?: string;
  vin?: string;
  contractNumber?: string;
}

export interface AddOnRefundLineBreakdown {
  label: string;
  originalCostUsd: number;
  refundMode: 'FULL_FREE_LOOK' | 'PRORATED' | 'DISPUTE_ONLY';
  estimatedRefundUsd: number;
  adminFeeDeductedUsd: number;
  note: string;
}

export interface AddOnRefundEstimate {
  daysSincePurchase: number;
  monthsElapsed: number;
  milesDriven: number;
  withinFreeLook: boolean;
  stateFreeLookDays: number;
  stateAdminFeeCapUsd: number;
  totalAddOnsPaidUsd: number;
  estimatedPrincipalRefundUsd: number;
  estimatedLoanInterestSavedUsd: number;
  totalRecoverableValueUsd: number;
  estimatedMonthsCutFromLoan: number;
  lines: AddOnRefundLineBreakdown[];
}

export const AUTO_ADDONS_GUIDE: AutoAddOnItem[] = [
  {
    id: 'sales-tax',
    name: 'State & Local Sales Tax',
    shortLabel: 'Sales Tax',
    category: 'STATUTORY',
    legallyRequired: 'REQUIRED',
    typicalDealerPrice: '0% – 10.25% of taxable price',
    realMarketCost: 'Exact state/county statutory rate',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'Mandatory government tax collected by the dealer and remitted to your state. In most states (except CA, HI, VA, and a few caps), your trade-in value reduces your taxable price.',
    dealerPitch: 'Required by state law.',
    yourRebuttal:
      'Verify the percentage matches your home ZIP code (where the car is registered), NOT the dealership ZIP code, and confirm your trade-in credit is subtracted before tax.',
    cancellationNotes: 'Statutory tax is non-cancellable, though cancelled add-ons may reduce taxable principal in some states.',
  },
  {
    id: 'title-reg',
    name: 'Title, Registration & License Plate Fees',
    shortLabel: 'DMV Title & Reg',
    category: 'STATUTORY',
    legallyRequired: 'REQUIRED',
    typicalDealerPrice: '$75 – $850 (state dependent)',
    realMarketCost: 'Exact state DMV fee',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'Actual government DMV charges to title and register the vehicle in your name. Dealers must refund you any over-collected estimate.',
    dealerPitch: 'Government title and tag fees.',
    yourRebuttal:
      'Ask for itemized government-only fees separated from dealer "e-filing" or "tag agency" markups.',
    cancellationNotes: 'Actual DMV fees are required; any excess estimate collected by the dealer must be refunded.',
  },
  {
    id: 'doc-fee',
    name: 'Dealer Documentation ("Doc") Fee',
    shortLabel: 'Doc Fee',
    category: 'DEALER_FEE',
    legallyRequired: 'CONDITIONAL',
    typicalDealerPrice: '$85 – $1,299',
    realMarketCost: '$50 – $150 paperwork processing',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'NOT a government fee — it is dealer profit for paperwork. Many states cap it by law (e.g., CA $85, NY $175, TX $225). Uncapped states (FL, GA, NC, VA) often charge $799–$1,299.',
    dealerPitch: '"Everyone pays it — we legally cannot remove the doc fee."',
    yourRebuttal:
      '"That\'s fine if it has to stay printed on the form — please discount the vehicle selling price by the exact excess above $200 so my Out-The-Door total stays unchanged."',
    cancellationNotes: 'Cannot be cancelled post-purchase unless it violated your state statutory cap (if it exceeded the state cap, demand an immediate statutory refund!).',
  },
  {
    id: 'extended-warranty',
    name: 'Extended Warranty / Vehicle Service Contract (VSC)',
    shortLabel: 'Extended Warranty (VSC)',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$2,200 – $4,800',
    realMarketCost: '$900 – $1,900 (direct OEM online dealers)',
    cancellableAfterPurchase: 'YES_FULL_OR_PRORATED',
    plainEnglish:
      'A mechanical breakdown service contract sold in the F&I office at 100%–200% markup. Never legally required to buy a car or get loan approval — claiming a lender requires it is illegal tied selling.',
    dealerPitch: '"Modern cars have $8,000 computers — and the bank likes seeing coverage on this loan."',
    yourRebuttal:
      '"I\'m declining all service contracts today. If I want an OEM extended warranty later, I can buy the exact same factory plan online before my 3yr/36k warranty expires for half the price."',
    cancellationNotes:
      '100% full refund within 30–60 days (no claims); prorated refund anytime after based on remaining months/miles minus a small state-capped fee ($25–$75). Bypass a stalling dealer by cancelling directly with the administrator.',
  },
  {
    id: 'gap-waiver',
    name: 'GAP Insurance / GAP Debt Waiver',
    shortLabel: 'GAP Waiver',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$895 – $1,495',
    realMarketCost: '$200 – $400 (credit union or auto insurer)',
    cancellableAfterPurchase: 'YES_FULL_OR_PRORATED',
    plainEnglish:
      'Covers the gap between insurance payout and loan balance if the car is totaled. Useful ONLY if you put <20% down or rolled negative equity — and even then, dealer GAP costs 3×–4× more than your insurer or credit union.',
    dealerPitch: '"If you total the car driving off the lot, you\'ll owe thousands — we bundle it right into the payment."',
    yourRebuttal:
      '"I either have sufficient equity or will add loan/lease payoff coverage through my auto insurer / credit union for ~$250 instead of financing $1,200 at interest."',
    cancellationNotes:
      'Almost always cancellable! 100% refund inside 30–60 days; prorated refund thereafter. Also legally refundable if you pay off, sell, or refinance the loan early!',
  },
  {
    id: 'tire-wheel',
    name: 'Tire & Wheel / Dent / Windshield / Key Protection',
    shortLabel: 'Tire, Wheel & Key',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$695 – $1,995',
    realMarketCost: '$120 – $350 (road hazard at tire shops)',
    cancellableAfterPurchase: 'YES_FULL_OR_PRORATED',
    plainEnglish:
      'High-commission ancillary protection bundles with narrow claim exclusions (cosmetic rash often excluded, strict tread-depth rules). Never required.',
    dealerPitch: '"One bent rim on these alloy wheels costs $1,200 — this pays for itself once."',
    yourRebuttal:
      '"No thanks — I\'ll self-insure or buy $30/tire road-hazard coverage at Discount Tire/Costco when needed."',
    cancellationNotes:
      'Cancellable under the contract\'s free-look (typically 30–60 days full refund) and prorated thereafter if no claims have been paid.',
  },
  {
    id: 'prepaid-maintenance',
    name: 'Prepaid Maintenance / Oil Change Plan',
    shortLabel: 'Prepaid Maintenance',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$895 – $2,100',
    realMarketCost: '$300 – $650 pay-as-you-go',
    cancellableAfterPurchase: 'YES_FULL_OR_PRORATED',
    plainEnglish:
      'Pre-paying for basic oil changes and tire rotations — often financed at 7%–10% APR! Many new cars already include 2 years of factory complimentary maintenance.',
    dealerPitch: '"Locks in today\'s service prices against inflation for 4 years."',
    yourRebuttal:
      '"I\'m not paying interest on future oil changes. Please remove the maintenance plan."',
    cancellationNotes:
      'Cancellable for a full refund if unused within free-look, or prorated for unused services/months.',
  },
  {
    id: 'paint-fabric',
    name: 'Paint / Ceramic / Fabric Protection ("EnviroGuard", "Xzilon")',
    shortLabel: 'Paint & Fabric Shield',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$795 – $1,995',
    realMarketCost: '$35 spray bottle / $150 real detailer',
    cancellableAfterPurchase: 'PARTIAL_OR_DISPUTABLE',
    plainEnglish:
      'Pure dealership profit packing. Usually a quick wipe-on sealant worth <$40 in materials disguised as a "warranty." Never legally required.',
    dealerPitch: '"It\'s already applied to every vehicle on our lot — we can\'t take it off."',
    yourRebuttal:
      '"I didn\'t request it. Either remove the charge completely or reduce the car\'s selling price by the same dollar amount."',
    cancellationNotes:
      'If sold as an ancillary service/appearance warranty contract, check the cancellation clause (many have 30–60 day cancellation rights). If billed as a physical product, dispute if it was never disclosed or falsely called "mandatory."',
  },
  {
    id: 'vin-etch',
    name: 'VIN Etching / Anti-Theft Recovery ("LoJack", "Karr", "Pulse")',
    shortLabel: 'VIN Etch / Pulse / GPS',
    category: 'FI_ADDON',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$495 – $1,495',
    realMarketCost: '$25 DIY kit / $60 hardware',
    cancellableAfterPurchase: 'PARTIAL_OR_DISPUTABLE',
    plainEnglish:
      'Flashing third-brake-light modules ("Pulse"), window acid-etching, or dealer GPS trackers marked up 10×–20×. Completely optional.',
    dealerPitch: '"Our insurance requires us to install theft protection on every vehicle."',
    yourRebuttal:
      '"Your dealership\'s lot insurance is your overhead cost, not mine. Remove it or take it off the selling price."',
    cancellationNotes:
      'If sold as a Theft Deterrent Benefit / Service Contract, check the back of the form — most carry a 30–60 day cancellation clause!',
  },
  {
    id: 'nitrogen',
    name: 'Nitrogen-Filled Tires',
    shortLabel: 'Nitrogen Tires',
    category: 'DEALER_FEE',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$199 – $499',
    realMarketCost: '$0 (regular air is already 78% nitrogen!)',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'The most infamous junk fee in car sales. Regular compressed air is 78% nitrogen, and Costco fills nitrogen for free.',
    dealerPitch: '"Already installed in all our inventory with green valve caps."',
    yourRebuttal: '"Let the air out and put regular air back in — I\'m paying $0 for nitrogen."',
    cancellationNotes: 'Always strip BEFORE signing; non-cancellable physical add-on after delivery.',
  },
  {
    id: 'dealer-prep',
    name: 'Dealer Prep / Reconditioning / Electronic Filing Fee',
    shortLabel: 'Prep / Recon / E-Filing',
    category: 'DEALER_FEE',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$395 – $1,995',
    realMarketCost: '$0 (already paid by automaker PDI or built into advertised price)',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'Double-dipping junk fee. Automakers already pay dealers for Pre-Delivery Inspection (PDI) on new cars, and used-car reconditioning belongs inside the advertised price.',
    dealerPitch: '"Standard inspection and electronic DMV filing fee."',
    yourRebuttal:
      '"The advertised price must include a roadworthy car. Remove recon/prep fees or I\'ll buy from a dealer with transparent pricing."',
    cancellationNotes: 'Must be negotiated off BEFORE signing; if it violated advertised-price laws in your state, you can file a State AG / FTC complaint.',
  },
  {
    id: 'market-adjustment',
    name: 'Additional Dealer Markup (ADM) / Market Adjustment',
    shortLabel: 'Market Adjustment',
    category: 'DEALER_FEE',
    legallyRequired: 'OPTIONAL',
    typicalDealerPrice: '$1,000 – $10,000+',
    realMarketCost: '$0 pure profit above MSRP',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'Arbitrary markup above Manufacturer Suggested Retail Price (MSRP). On 95% of vehicles today, competing dealers within 50–100 miles sell at or below MSRP.',
    dealerPitch: '"High-demand trim — every dealer in town is charging this."',
    yourRebuttal:
      '"I\'m emailing 5 dealers within 100 miles today for straight MSRP or below. Let me know if you want to match."',
    cancellationNotes: 'Negotiate out before signing via multi-dealer OTD quotes.',
  },
  {
    id: 'acquisition-fee',
    name: 'Lease Acquisition & Disposition Fees',
    shortLabel: 'Lease Acq / Disp Fees',
    category: 'LEASE_FEE',
    legallyRequired: 'CONDITIONAL',
    typicalDealerPrice: '$595 – $995 (Acq) / $350 – $495 (Disp)',
    realMarketCost: 'Set by captive lender (e.g. $650 Toyota, $695 Ford)',
    cancellableAfterPurchase: 'NO',
    plainEnglish:
      'Standard bank fees on a lease charged by the leasing bank — NOT the dealer. However, some dealers silently pad the acquisition fee by $200–$400.',
    dealerPitch: '"Standard bank lease fee."',
    yourRebuttal:
      '"Confirm that matches the lender\'s exact base acquisition fee with zero dealer markup, and tell me the exact base Money Factor."',
    cancellationNotes: 'Disposition fee is often waived if you lease/buy another vehicle from the same brand or buy out your lease.',
  },
];

export const STATE_AUTO_RULES: Record<string, StateAutoRule> = {
  AL: { code: 'AL', name: 'Alabama', docFeeCapUsd: null, typicalDocFeeUsd: 495, tradeInTaxCredit: true, typicalSalesTaxPct: 4.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No doc fee cap; trade-in credit reduces state sales tax.' },
  AK: { code: 'AK', name: 'Alaska', docFeeCapUsd: null, typicalDocFeeUsd: 299, tradeInTaxCredit: true, typicalSalesTaxPct: 0.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No state sales tax (some local boroughs charge small caps).' },
  AZ: { code: 'AZ', name: 'Arizona', docFeeCapUsd: null, typicalDocFeeUsd: 599, tradeInTaxCredit: true, typicalSalesTaxPct: 8.3, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No doc fee cap; strong trade-in sales tax credit.' },
  AR: { code: 'AR', name: 'Arkansas', docFeeCapUsd: 129, typicalDocFeeUsd: 129, tradeInTaxCredit: true, typicalSalesTaxPct: 6.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $129.' },
  CA: { code: 'CA', name: 'California', docFeeCapUsd: 85, typicalDocFeeUsd: 85, tradeInTaxCredit: false, typicalSalesTaxPct: 8.75, vscFreeLookDays: 60, vscMaxAdminFeeUsd: 25, notes: 'Strict $85 doc cap! 60-day VSC free-look & $25 max admin fee. NO trade-in sales tax credit (selling privately often wins!).' },
  CO: { code: 'CO', name: 'Colorado', docFeeCapUsd: null, typicalDocFeeUsd: 699, tradeInTaxCredit: true, typicalSalesTaxPct: 7.75, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'High uncapped dealer "D&H" fees ($699+); push back via OTD price.' },
  CT: { code: 'CT', name: 'Connecticut', docFeeCapUsd: null, typicalDocFeeUsd: 599, tradeInTaxCredit: true, typicalSalesTaxPct: 6.35, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped conveyance fee must be disclosed; trade-in credit applies.' },
  DE: { code: 'DE', name: 'Delaware', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 4.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '4.25% document/registration fee instead of sales tax; trade-in credited.' },
  FL: { code: 'FL', name: 'Florida', docFeeCapUsd: null, typicalDocFeeUsd: 999, tradeInTaxCredit: true, typicalSalesTaxPct: 7.0, vscFreeLookDays: 60, vscMaxAdminFeeUsd: 50, notes: 'Highest uncapped doc fees in the US ($899–$1,299)! Strong 60-day VSC full-refund law.' },
  GA: { code: 'GA', name: 'Georgia', docFeeCapUsd: null, typicalDocFeeUsd: 799, tradeInTaxCredit: true, typicalSalesTaxPct: 7.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees ($699–$999). 7% TAVT tax with full trade-in credit.' },
  HI: { code: 'HI', name: 'Hawaii', docFeeCapUsd: null, typicalDocFeeUsd: 395, tradeInTaxCredit: false, typicalSalesTaxPct: 4.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No trade-in tax credit.' },
  ID: { code: 'ID', name: 'Idaho', docFeeCapUsd: null, typicalDocFeeUsd: 399, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No doc cap; full trade-in tax credit.' },
  IL: { code: 'IL', name: 'Illinois', docFeeCapUsd: 368, typicalDocFeeUsd: 368, tradeInTaxCredit: true, typicalSalesTaxPct: 8.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee indexed annually (~$358–$368 cap); trade-in credit fully restored.' },
  IN: { code: 'IN', name: 'Indiana', docFeeCapUsd: 245, typicalDocFeeUsd: 245, tradeInTaxCredit: true, typicalSalesTaxPct: 7.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped around $235–$245.' },
  IA: { code: 'IA', name: 'Iowa', docFeeCapUsd: 180, typicalDocFeeUsd: 180, tradeInTaxCredit: true, typicalSalesTaxPct: 5.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $180.' },
  KS: { code: 'KS', name: 'Kansas', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 8.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped admin fees; strong trade-in credit.' },
  KY: { code: 'KY', name: 'Kentucky', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Trade-in credit applies on used & new purchases.' },
  LA: { code: 'LA', name: 'Louisiana', docFeeCapUsd: 425, typicalDocFeeUsd: 425, tradeInTaxCredit: true, typicalSalesTaxPct: 9.45, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $425; high sales tax makes trade-in credit very valuable.' },
  ME: { code: 'ME', name: 'Maine', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 5.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees; trade-in credited.' },
  MD: { code: 'MD', name: 'Maryland', docFeeCapUsd: 800, typicalDocFeeUsd: 800, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee statutory cap recently raised to $800.' },
  MA: { code: 'MA', name: 'Massachusetts', docFeeCapUsd: null, typicalDocFeeUsd: 495, tradeInTaxCredit: true, typicalSalesTaxPct: 6.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees; full trade-in credit.' },
  MI: { code: 'MI', name: 'Michigan', docFeeCapUsd: 260, typicalDocFeeUsd: 260, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped (~$260); trade-in credit capped at $10k–$11k.' },
  MN: { code: 'MN', name: 'Minnesota', docFeeCapUsd: 275, typicalDocFeeUsd: 275, tradeInTaxCredit: true, typicalSalesTaxPct: 6.875, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $275 (recent statutory update).' },
  MS: { code: 'MS', name: 'Mississippi', docFeeCapUsd: null, typicalDocFeeUsd: 425, tradeInTaxCredit: true, typicalSalesTaxPct: 5.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No statutory doc cap; 5% auto sales tax.' },
  MO: { code: 'MO', name: 'Missouri', docFeeCapUsd: 604, typicalDocFeeUsd: 565, tradeInTaxCredit: true, typicalSalesTaxPct: 7.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Admin fee capped (~$565–$604); you even get trade-in credit if selling privately within 180 days!' },
  MT: { code: 'MT', name: 'Montana', docFeeCapUsd: null, typicalDocFeeUsd: 299, tradeInTaxCredit: false, typicalSalesTaxPct: 0.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '0% state sales tax!' },
  NE: { code: 'NE', name: 'Nebraska', docFeeCapUsd: null, typicalDocFeeUsd: 399, tradeInTaxCredit: true, typicalSalesTaxPct: 7.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'No doc cap; full trade-in credit.' },
  NV: { code: 'NV', name: 'Nevada', docFeeCapUsd: null, typicalDocFeeUsd: 599, tradeInTaxCredit: true, typicalSalesTaxPct: 8.375, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees ($499–$699); full trade-in credit.' },
  NH: { code: 'NH', name: 'New Hampshire', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: false, typicalSalesTaxPct: 0.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '0% state sales tax.' },
  NJ: { code: 'NJ', name: 'New Jersey', docFeeCapUsd: null, typicalDocFeeUsd: 799, tradeInTaxCredit: true, typicalSalesTaxPct: 6.625, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees ($699–$995); full trade-in credit.' },
  NM: { code: 'NM', name: 'New Mexico', docFeeCapUsd: null, typicalDocFeeUsd: 399, tradeInTaxCredit: true, typicalSalesTaxPct: 4.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '4% motor vehicle excise tax; trade-in credited.' },
  NY: { code: 'NY', name: 'New York', docFeeCapUsd: 175, typicalDocFeeUsd: 175, tradeInTaxCredit: true, typicalSalesTaxPct: 8.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Strict $175 statutory doc fee cap! Refuse any extra "prep" or "e-filing" fee.' },
  NC: { code: 'NC', name: 'North Carolina', docFeeCapUsd: null, typicalDocFeeUsd: 799, tradeInTaxCredit: true, typicalSalesTaxPct: 3.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'High uncapped doc fees ($699–$899), low 3% Highway Use Tax with trade-in credit.' },
  ND: { code: 'ND', name: 'North Dakota', docFeeCapUsd: null, typicalDocFeeUsd: 299, tradeInTaxCredit: true, typicalSalesTaxPct: 5.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '5% motor vehicle excise tax; trade-in credited.' },
  OH: { code: 'OH', name: 'Ohio', docFeeCapUsd: 387, typicalDocFeeUsd: 387, tradeInTaxCredit: true, typicalSalesTaxPct: 7.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee cap recently raised to $387; trade-in credit applies on NEW cars (not used!).' },
  OK: { code: 'OK', name: 'Oklahoma', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: false, typicalSalesTaxPct: 4.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees; no trade-in tax credit on excise tax.' },
  OR: { code: 'OR', name: 'Oregon', docFeeCapUsd: 250, typicalDocFeeUsd: 250, tradeInTaxCredit: false, typicalSalesTaxPct: 0.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped ($200–$250); 0.5% privilege tax only.' },
  PA: { code: 'PA', name: 'Pennsylvania', docFeeCapUsd: 464, typicalDocFeeUsd: 464, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped (~$464 online registration); full trade-in credit.' },
  RI: { code: 'RI', name: 'Rhode Island', docFeeCapUsd: 400, typicalDocFeeUsd: 400, tradeInTaxCredit: true, typicalSalesTaxPct: 7.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $400; trade-in credit on passenger cars.' },
  SC: { code: 'SC', name: 'South Carolina', docFeeCapUsd: null, typicalDocFeeUsd: 599, tradeInTaxCredit: true, typicalSalesTaxPct: 5.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Sales tax capped at $500 max! Watch out for $599+ uncapped "closing fees".' },
  SD: { code: 'SD', name: 'South Dakota', docFeeCapUsd: null, typicalDocFeeUsd: 299, tradeInTaxCredit: true, typicalSalesTaxPct: 4.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '4% excise tax with trade-in credit.' },
  TN: { code: 'TN', name: 'Tennessee', docFeeCapUsd: null, typicalDocFeeUsd: 699, tradeInTaxCredit: true, typicalSalesTaxPct: 7.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees ($599–$799); strong trade-in credit.' },
  TX: { code: 'TX', name: 'Texas', docFeeCapUsd: 225, typicalDocFeeUsd: 225, tradeInTaxCredit: true, typicalSalesTaxPct: 6.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $225! Strong 6.25% trade-in tax credit.' },
  UT: { code: 'UT', name: 'Utah', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 7.25, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees; full trade-in credit.' },
  VT: { code: 'VT', name: 'Vermont', docFeeCapUsd: null, typicalDocFeeUsd: 499, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: '6% purchase & use tax; full trade-in credit.' },
  VA: { code: 'VA', name: 'Virginia', docFeeCapUsd: null, typicalDocFeeUsd: 899, tradeInTaxCredit: false, typicalSalesTaxPct: 4.15, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Notoriously high uncapped processing fees ($799–$999) and NO trade-in tax credit!' },
  WA: { code: 'WA', name: 'Washington', docFeeCapUsd: 200, typicalDocFeeUsd: 200, tradeInTaxCredit: true, typicalSalesTaxPct: 9.8, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 25, notes: 'Doc fee capped at $200! High sales tax (~9.8%) makes trade-in tax credit huge.' },
  WV: { code: 'WV', name: 'West Virginia', docFeeCapUsd: 175, typicalDocFeeUsd: 175, tradeInTaxCredit: true, typicalSalesTaxPct: 6.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Doc fee capped at $175.' },
  WI: { code: 'WI', name: 'Wisconsin', docFeeCapUsd: null, typicalDocFeeUsd: 399, tradeInTaxCredit: true, typicalSalesTaxPct: 5.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Service fee uncapped but must be disclosed.' },
  WY: { code: 'WY', name: 'Wyoming', docFeeCapUsd: null, typicalDocFeeUsd: 299, tradeInTaxCredit: true, typicalSalesTaxPct: 5.0, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Low fees; full trade-in tax credit.' },
  DC: { code: 'DC', name: 'District of Columbia', docFeeCapUsd: null, typicalDocFeeUsd: 699, tradeInTaxCredit: false, typicalSalesTaxPct: 6.5, vscFreeLookDays: 30, vscMaxAdminFeeUsd: 50, notes: 'Uncapped doc fees; no trade-in tax credit.' },
};

export const FI_ADMINISTRATORS: FiAdministratorInfo[] = [
  {
    id: 'fidelity-jma',
    name: 'Fidelity Warranty Services / JM&A Group',
    products: 'Platinum/Gold/Powertrain VSC, GAP, Tire & Wheel, Road Hazard',
    freeLookWindow: '30–60 days full refund (state dependent); prorated after',
    cancellationAddress: 'Fidelity Warranty Services, Attn: Cancellations Dept., P.O. Box 8567, Deerfield Beach, FL 33443',
    directBypassTip:
      'Fidelity phone reps often tell callers to return to the dealer first, BUT accept direct signed written cancellation via Certified Mail when you state the selling dealer is unresponsive.',
    requiredDocs: ['Signed Cancellation Letter', 'Copy of VSC/GAP Declaration Page', 'Timestamped Odometer Photo'],
    contactHint: '1-800-327-5172 • fidelitywarrantyservices.com',
  },
  {
    id: 'ally',
    name: 'Ally Premier Protection / Ally GAP',
    products: 'Extended Warranty (VSC), GAP, Tire & Wheel, Maintenance',
    freeLookWindow: '60 days full refund (no claims); prorated after',
    cancellationAddress: 'Ally Premier Protection Cancellations, P.O. Box 8102, Cockeysville, MD 21030',
    directBypassTip:
      'Submit signed written cancellation + odometer photo directly to Ally Premier Protection Cancellations and CC your selling dealer F&I Director to lock in your effective date.',
    requiredDocs: ['Signed Cancellation Request Letter', 'VIN & Contract Number', 'Photo of Current Odometer', 'Lender Name & Account #'],
    contactHint: '1-877-247-2559 • ally.com/auto/vehicle-protection',
  },
  {
    id: 'zurich',
    name: 'Zurich Vehicle Service Contracts & GAP',
    products: 'Extended Warranty, GAP Waiver, Shield/Appearance Plans',
    freeLookWindow: '30–60 days full refund; prorated after ($25–$50 max fee)',
    cancellationAddress: 'Zurich F&I Cancellations, 7045 College Blvd, Overland Park, KS 66211',
    directBypassTip:
      'Request Zurich Customer Care\'s direct cancellation email/fax ticket and mail your signed notice so your effective mileage date is locked in immediately.',
    requiredDocs: ['Signed Cancellation Request', 'Contract # & VIN', 'Current Mileage Verification'],
    contactHint: '1-888-835-5063 • zurichna.com/auto',
  },
  {
    id: 'toyota-tfs',
    name: 'Toyota Financial Services (TFS) / Extra Care / GAP',
    products: 'Toyota Extra Care VSA, Prepaid Maintenance, TFS GAP',
    freeLookWindow: '30 days full refund (60 days CA/FL); prorated after',
    cancellationAddress: 'Toyota Motor Insurance Services, Attn: Cancellations, P.O. Box 9550, Cedar Rapids, IA 52409',
    directBypassTip:
      'TFS has one of the cleanest direct-cancellation channels in the industry — mail or fax TFS Product Cancellation directly and bypass the F&I desk completely!',
    requiredDocs: ['Signed Cancellation Form/Letter', 'VIN & Agreement #', 'Current Odometer Reading'],
    contactHint: '1-800-228-8559 • toyotafinancial.com',
  },
  {
    id: 'ford-protect',
    name: 'Ford Protect / Lincoln Protect (ESP)',
    products: 'PremiumCARE / ExtraCARE ESP, Maintenance, TireCARE, GAP',
    freeLookWindow: '30 days full refund (60 days CA/FL); prorated after',
    cancellationAddress: 'Ford Protect Administration, Attn: ESP Cancellations, P.O. Box 6045, Dearborn, MI 48121',
    directBypassTip:
      'If your selling dealer stalls, call Ford Protect HQ directly and open an Escalated Direct Cancellation case with your signed letter.',
    requiredDocs: ['Signed Cancellation Notice', 'VIN & ESP Contract #', 'Odometer Statement'],
    contactHint: '1-800-392-3673 • fordprotect.ford.com',
  },
  {
    id: 'honda-care',
    name: 'American Honda Finance / Honda Care & Acura Care',
    products: 'Honda Care VSC, Sentinel Maintenance, Honda GAP',
    freeLookWindow: '60 days full refund (no claims); prorated after',
    cancellationAddress: 'Honda Care Plan Administration, Attn: Cancellations, P.O. Box 2225, Torrance, CA 90509',
    directBypassTip:
      'Honda Care grants a generous 60-day full refund window nationwide and accepts direct written cancellation notices.',
    requiredDocs: ['Signed Written Request', 'VIN & Honda Care Contract #', 'Current Odometer Statement'],
    contactHint: '1-800-999-5901 • hondafinancialservices.com',
  },
  {
    id: 'gm-protection',
    name: 'GM Protection Plan / Chevrolet / GMC / Cadillac',
    products: 'Platinum/Silver VSC, GAP, Pre-Paid Maintenance, Tire & Wheel',
    freeLookWindow: '60 days full refund (no claims); prorated after',
    cancellationAddress: 'GM Protections Cancellations (Amtel/Safe-Guard Admin), Two Concourse Pkwy, Suite 500, Atlanta, GA 30328',
    directBypassTip:
      'Check the fine print footer on page 1 (newer GM plans are administered by Safe-Guard/Amtel) and send written notice directly to the listed administrator.',
    requiredDocs: ['Signed Cancellation Letter', 'VIN & Contract #', 'Odometer Photo'],
    contactHint: '1-833-959-0105 • gm.com/protection',
  },
  {
    id: 'nissan-nesna',
    name: 'Nissan Security+Plus / Infiniti Elite Protection',
    products: 'Gold/Silver Preferred VSC, Prepaid Maintenance, GAP',
    freeLookWindow: '60 days full refund (no claims); prorated after',
    cancellationAddress: 'Nissan Extended Services NA, Attn: Cancellations, P.O. Box 685004, Franklin, TN 37068',
    directBypassTip:
      'NESNA processes written cancellations directly by mail/fax when accompanied by a signed odometer statement.',
    requiredDocs: ['Signed Cancellation Request', 'VIN & Policy #', 'Odometer Reading'],
    contactHint: '1-800-647-7261 • nissanusa.com/owners',
  },
  {
    id: 'hyundai-kia',
    name: 'Hyundai Protection Plan / Kia Distinction',
    products: 'Wrap/Powertrain VSC, GAP, Excess Wear, Tire & Wheel',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Hyundai Capital / Safe-Guard Cancellations, P.O. Box 88230, Atlanta, GA 30356',
    directBypassTip:
      'Send written cancellation directly to the plan administrator printed at the bottom of your agreement + CC your dealer F&I manager.',
    requiredDocs: ['Signed Written Notice', 'VIN & Agreement #', 'Odometer Photo'],
    contactHint: '1-800-477-8089 • hmfusa.com',
  },
  {
    id: 'subaru-sas',
    name: 'Subaru Added Security (SAS)',
    products: 'Classic & Gold Plus Extended Plans, Equity Shield GAP',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Subaru of America, Attn: Added Security Cancellations, P.O. Box 6000, Cherry Hill, NJ 08034',
    directBypassTip:
      'Subaru Added Security is backed directly by Subaru of America and processes written owner cancellations cleanly.',
    requiredDocs: ['Signed Cancellation Notice', 'VIN & Agreement #', 'Current Mileage'],
    contactHint: '1-800-782-2783 • subaru.com',
  },
  {
    id: 'assurant',
    name: 'Assurant / Resource Automotive / The Warranty Group',
    products: 'VSC, GAP Waiver, Appearance & Ancillary Bundles',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Assurant Automotive Cancellations, P.O. Box 77199, Madison, WI 53707',
    directBypassTip:
      'Submit written cancellation directly to Assurant Cancellations and CC both the dealer F&I Director and your auto lender.',
    requiredDocs: ['Signed Written Request', 'VIN & Policy/Contract #', 'Current Odometer Photo'],
    contactHint: '1-800-358-0600 • assurant.com',
  },
  {
    id: 'safe-guard',
    name: 'Safe-Guard Products International',
    products: 'OEM-Branded GAP, Tire & Wheel, VSC, Theft/Appearance Plans',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Safe-Guard Products Intl, Attn: Cancellations, Two Concourse Pkwy, Suite 500, Atlanta, GA 30328',
    directBypassTip:
      'Safe-Guard administers private-label GAP & Tire/Wheel for over 15 major automakers (Audi, BMW, Mercedes, Hyundai, Mazda, VW) — check fine print for Safe-Guard!',
    requiredDocs: ['Signed Cancellation Letter', 'VIN & Contract #', 'Odometer Statement'],
    contactHint: '1-800-742-7896 • safe-guardproducts.com',
  },
  {
    id: 'cna-national',
    name: 'CNA National Warranty Corporation',
    products: 'Automotive Preferred Care VSC, GAP, Tire & Wheel',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'CNA National Warranty Corp, Attn: Cancellations, P.O. Box 2840, Scottsdale, AZ 85252',
    directBypassTip:
      'Send signed cancellation + odometer verification directly to CNA National in Scottsdale if the selling dealership fails to process within 10 business days.',
    requiredDocs: ['Signed Request', 'Contract # & VIN', 'Odometer Photo'],
    contactHint: '1-800-345-0191 • cnanational.com',
  },
  {
    id: 'easycare',
    name: 'EasyCare / APCO Holdings / GWC Warranty',
    products: 'TotalCare / StatedCare VSC, GAP, KeyCare, Used-Car VSC',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'APCO / EasyCare Cancellations, P.O. Box 80100, Atlanta, GA 30366',
    directBypassTip:
      'Request EasyCare/APCO\'s direct Cancellation Form or mail our signed notice with a dashboard odometer photo to lock in your effective date.',
    requiredDocs: ['Signed Request / Form', 'VIN & Contract #', 'Odometer Photo'],
    contactHint: '1-800-538-4181 • easycare.com',
  },
  {
    id: 'protective-aul',
    name: 'Protective Asset Protection / AUL Corp',
    products: 'Used & New Vehicle Service Contracts, GAP, Ancillary',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Protective Asset Protection, Attn: Cancellations, P.O. Box 770, Deerfield, IL 60015',
    directBypassTip:
      'Protective/AUL is huge at independent & franchise used lots; send written notice to both dealer & Protective HQ simultaneously.',
    requiredDocs: ['Signed Cancellation Letter', 'VIN & Contract #', 'Current Odometer Statement'],
    contactHint: '1-800-323-5771 • protectiveassetprotection.com',
  },
  {
    id: 'portfolio',
    name: 'Portfolio Protection / Portfolio Services',
    products: 'Dealer Reinsurance VSC, GAP, Theft & Appearance Contracts',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'Portfolio Services, Attn: Cancellations Dept., 25541 Commercentre Dr, Suite 100, Lake Forest, CA 92630',
    directBypassTip:
      'Dealer-owned reinsurance plans often push back hardest at the dealership — always send Certified Mail directly to Portfolio HQ + CC your State Insurance Dept. if stalled.',
    requiredDocs: ['Signed Written Notice', 'Contract Declaration Copy', 'Odometer Photo'],
    contactHint: '1-800-705-4001 • portfolioco.com',
  },
  {
    id: 'first-extended',
    name: 'First Extended Service Corp / Warrantech',
    products: 'VSC, Powertrain, GAP & Dealer Ancillary Plans',
    freeLookWindow: '30–60 days full refund; prorated after',
    cancellationAddress: 'First Extended Service Corp, Attn: Cancellations, 2200 Highway 121, Suite 100, Bedford, TX 76021',
    directBypassTip:
      'Include your lienholder payoff address and current odometer photo so First Extended cannot delay processing for missing fields.',
    requiredDocs: ['Signed Cancellation Letter', 'VIN & Contract #', 'Odometer Photo'],
    contactHint: '1-800-527-3426 • firstextended.com',
  },
  {
    id: 'endurance',
    name: 'Endurance Warranty Services (Direct / Third-Party)',
    products: 'Direct-to-Consumer Vehicle Service Contracts',
    freeLookWindow: '30 days full refund (minus any claims); prorated after',
    cancellationAddress: 'Endurance Warranty Services, Attn: Cancellations, 400 Skokie Blvd, Suite 105, Northbrook, IL 60062',
    directBypassTip:
      'Never rely solely on a phone call with retention reps — send a signed notarized/attested cancellation + odometer statement in writing to stop monthly billing.',
    requiredDocs: ['Signed Cancellation Form/Letter', 'Contract # & VIN', 'Odometer Statement'],
    contactHint: '1-866-432-4443 • endurancewarranty.com',
  },
  {
    id: 'carshield',
    name: 'CarShield / American Auto Shield',
    products: 'Month-to-Month & Term Vehicle Service Contracts',
    freeLookWindow: '30 days full refund; month-to-month cancel anytime in writing',
    cancellationAddress: 'American Auto Shield (CarShield Admin), Attn: Cancellations, 1597 Cole Blvd, Suite 200, Lakewood, CO 80401',
    directBypassTip:
      'Send written cancellation directly to both CarShield AND the actual administrator (American Auto Shield) so recurring billing stops immediately.',
    requiredDocs: ['Signed Written Notice', 'Contract # & VIN', 'Current Odometer'],
    contactHint: '1-800-587-4162 • americanautoshield.com',
  },
  {
    id: 'carmax-maxcare',
    name: 'CarMax MaxCare (Administered by Fidelity / Assurant)',
    products: 'MaxCare Extended Service Plan & CarMax GAP',
    freeLookWindow: '90 days full refund (CarMax policy!) / prorated after',
    cancellationAddress: 'CarMax Auto Superstores / Plan Administrator Listed on Page 1 of MaxCare Agreement',
    directBypassTip:
      'CarMax offers an industry-best 90-day full refund window on MaxCare (if no claims) and processes written cancellations cleanly at any store business office or by mail.',
    requiredDocs: ['Contract # & VIN', 'Current Odometer Reading', 'Signed Request'],
    contactHint: '1-800-519-1511 • carmax.com',
  },
];

export const AUTO_CONSUMER_RESOURCES: ConsumerProtectionResource[] = [
  {
    name: 'CFPB — Consumer Financial Protection Bureau',
    role: 'Federal Auto Loan & Financing Watchdog',
    whenToUse:
      'File a formal complaint if a dealer or lender refuses to process a GAP/VSC cancellation, stalls past 30 days, or engaged in illegal "tied selling" (claiming you had to buy a warranty to get financed).',
    url: 'https://www.consumerfinance.gov/complaint/',
  },
  {
    name: 'FTC — ReportFraud.ftc.gov',
    role: 'Federal Trade Commission (Deceptive Pricing & Junk Fees)',
    whenToUse:
      'Report hidden payment packing, undisclosed add-ons slipped into contracts, or bait-and-switch advertised pricing.',
    url: 'https://reportfraud.ftc.gov/',
  },
  {
    name: 'State Insurance Commissioner (NAIC Directory)',
    role: 'Regulates Service Contracts & GAP Administrators',
    whenToUse:
      'In most states, VSC & GAP providers are licensed by the Dept. of Insurance. One complaint here usually gets a stalled refund issued within 7 business days.',
    url: 'https://content.naic.org/state-insurance-departments',
  },
  {
    name: 'State Attorney General Consumer Protection (NAAG)',
    role: 'Enforces State Doc Fee Caps & Lemon/Dealer Laws',
    whenToUse:
      'Use when a dealer violates your state statutory doc fee cap, refuses a lawful refund, or misrepresents fees as "required by law."',
    url: 'https://www.naag.org/find-my-ag/',
  },
];

function monthlyPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r <= 0) return principal / months;
  return (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1);
}

function presentValueFromPayment(monthly: number, aprPct: number, months: number): number {
  if (monthly <= 0 || months <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r <= 0) return monthly * months;
  return (monthly * (Math.pow(1 + r, months) - 1)) / (r * Math.pow(1 + r, months));
}

function solveImpliedApr(principal: number, monthly: number, months: number): number | null {
  if (principal <= 0 || monthly <= 0 || months <= 0) return null;
  if (monthly * months <= principal) return 0;
  let lo = 0;
  let hi = 45;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const pmt = monthlyPayment(principal, mid, months);
    if (pmt < monthly) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/**
 * Stage 2 ("At the Dealership"): Reverse-engineers a dealer's Four-Square monthly payment
 * to expose hidden add-ons ("payment packing") or inflated APR reserve!
 */
export function calculateFourSquareReverse(input: FourSquareInput): FourSquareResult {
  const price = Math.max(0, Number(input.vehiclePriceUsd) || 0);
  const down = Math.max(0, Number(input.downOrTradeUsd) || 0);
  const taxPct = Math.max(0, Math.min(15, Number(input.salesTaxPct) || 7.25));
  const fees = Math.max(0, Number(input.titleRegDocUsd) || 550);
  const months = Math.max(12, Math.min(96, Math.round(Number(input.termMonths) || 60)));
  const quotedMonthly = Math.max(0, Number(input.dealerQuotedMonthlyUsd) || 0);
  const fairApr = Math.max(0, Number(input.expectedFairAprPct) || 6.0);

  const fairOtd = price * (1 + taxPct / 100) + fees;
  const fairAmountFinancedUsd = Math.max(0, Math.round(fairOtd - down));
  const fairMonthlyUsd = Math.round(monthlyPayment(fairAmountFinancedUsd, fairApr, months) * 100) / 100;
  const monthlyOverchargeUsd = Math.round((quotedMonthly - fairMonthlyUsd) * 100) / 100;
  const totalPaymentGapUsd = Math.round(monthlyOverchargeUsd * months);

  const impliedPrincipalAtFairAprUsd = Math.round(
    presentValueFromPayment(quotedMonthly, fairApr, months)
  );
  const hiddenMarkupEstimateUsd = Math.max(0, impliedPrincipalAtFairAprUsd - fairAmountFinancedUsd);
  const impliedAprAtFairPricePct = solveImpliedApr(fairAmountFinancedUsd, quotedMonthly, months);

  let verdict: FourSquareResult['verdict'] = 'CLEAN';
  let explanation =
    'This monthly payment lines up closely with the vehicle price and your benchmark APR. Still ask for the itemized Out-The-Door breakdown before signing.';

  if (monthlyOverchargeUsd > 45 || hiddenMarkupEstimateUsd > 2200) {
    verdict = 'HEAVY_PACKING';
    explanation = `RED ALERT: At ${fairApr}% APR, your clean payment should be ~$${fairMonthlyUsd.toFixed(
      0
    )}/mo. Their $${quotedMonthly.toFixed(
      0
    )}/mo quote is hiding ~$${hiddenMarkupEstimateUsd.toLocaleString()} in unmentioned add-ons/fees OR an inflated ~${
      impliedAprAtFairPricePct ?? '?'
    }% APR — costing you $${totalPaymentGapUsd.toLocaleString()} extra over ${months} months!`;
  } else if (monthlyOverchargeUsd > 15 || hiddenMarkupEstimateUsd > 750) {
    verdict = 'SUSPICIOUS_MARKUP';
    explanation = `Caution: Their payment is $${monthlyOverchargeUsd.toFixed(
      0
    )}/mo higher than expected (~$${hiddenMarkupEstimateUsd.toLocaleString()} in hidden fees or ~${
      impliedAprAtFairPricePct ?? '?'
    }% APR). Ask for the exact Selling Price, Add-Ons, Doc Fee, and APR in writing.`;
  }

  return {
    fairAmountFinancedUsd,
    fairMonthlyUsd,
    monthlyOverchargeUsd,
    totalPaymentGapUsd,
    impliedPrincipalAtFairAprUsd,
    hiddenMarkupEstimateUsd,
    impliedAprAtFairPricePct,
    verdict,
    explanation,
  };
}

/**
 * Stage 1 ("Before You Buy"): Compares Manufacturer Promo APR vs. Cash Rebate + Credit Union Loan,
 * AND computes exact State Trade-In Sales Tax Credit break-even vs. private sale.
 */
export function calculatePromoVsRebate(input: PathCompareInput): PathCompareResult {
  const rule = STATE_AUTO_RULES[input.stateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const price = Math.max(0, Number(input.vehiclePriceUsd) || 0);
  const down = Math.max(0, Number(input.downPaymentUsd) || 0);
  const trade = Math.max(0, Number(input.tradeInValueUsd) || 0);
  const payoff = Math.max(0, Number(input.tradeInPayoffUsd) || 0);
  const months = Math.max(12, Math.min(84, Math.round(Number(input.termMonths) || 60)));
  const promoApr = Math.max(0, Number(input.promoAprPct) || 0);
  const rebate = Math.max(0, Number(input.cashRebateUsd) || 0);
  const cuApr = Math.max(0, Number(input.creditUnionAprPct) || 5.9);

  const taxRate = rule.typicalSalesTaxPct / 100;
  const docAndReg = (rule.docFeeCapUsd ?? rule.typicalDocFeeUsd) + 325;
  const tradeInTaxSavingsUsd = rule.tradeInTaxCredit ? Math.round(trade * taxRate) : 0;
  const privateSaleBreakEvenUsd = Math.round(trade + tradeInTaxSavingsUsd);
  const netTradeEquity = trade - payoff;

  // Path A: Take Promo APR (no cash rebate)
  const taxablePromo = Math.max(0, price - (rule.tradeInTaxCredit ? trade : 0));
  const promoFinanced = Math.max(0, Math.round(price + taxablePromo * taxRate + docAndReg - down - netTradeEquity));
  const promoMonthly = Math.round(monthlyPayment(promoFinanced, promoApr, months) * 100) / 100;
  const promoTotalPayments = Math.round(promoMonthly * months);
  const promoInterest = Math.max(0, promoTotalPayments - promoFinanced);

  // Path B: Take Cash Rebate + Credit Union Loan
  const priceAfterRebate = Math.max(0, price - rebate);
  const taxableRebate = Math.max(0, priceAfterRebate - (rule.tradeInTaxCredit ? trade : 0));
  const rebateFinanced = Math.max(
    0,
    Math.round(priceAfterRebate + taxableRebate * taxRate + docAndReg - down - netTradeEquity)
  );
  const rebateMonthly = Math.round(monthlyPayment(rebateFinanced, cuApr, months) * 100) / 100;
  const rebateTotalPayments = Math.round(rebateMonthly * months);
  const rebateInterest = Math.max(0, rebateTotalPayments - rebateFinanced);

  const diff = rebateTotalPayments - promoTotalPayments;
  let winner: PathCompareResult['winner'] = 'TIE';
  if (diff > 50) winner = 'PROMO_APR';
  else if (diff < -50) winner = 'CASH_REBATE';

  const advantageUsd = Math.abs(diff);
  const summary =
    winner === 'PROMO_APR'
      ? `Taking the ${promoApr}% Manufacturer Promo APR beats the $${rebate.toLocaleString()} cash rebate by $${advantageUsd.toLocaleString()} over ${months} months.`
      : winner === 'CASH_REBATE'
      ? `Taking the $${rebate.toLocaleString()} Cash Rebate + ${cuApr}% Credit Union financing beats the ${promoApr}% promo by $${advantageUsd.toLocaleString()} over ${months} months.`
      : 'Both financing paths cost virtually the same — take the cash rebate if you plan to pay off or trade the car early!';

  return {
    stateName: rule.name,
    tradeInTaxSavingsUsd,
    privateSaleBreakEvenUsd,
    promoPath: {
      amountFinancedUsd: promoFinanced,
      monthlyUsd: promoMonthly,
      totalInterestUsd: promoInterest,
      totalCostUsd: promoTotalPayments,
    },
    rebatePath: {
      amountFinancedUsd: rebateFinanced,
      monthlyUsd: rebateMonthly,
      totalInterestUsd: rebateInterest,
      totalCostUsd: rebateTotalPayments,
    },
    winner,
    advantageUsd,
    summary,
  };
}

/**
 * Stage 3 ("Already Bought?"): Computes exact Free-Look 100% vs. Prorated F&I Add-On Refund,
 * plus compound loan interest saved when the refund reduces loan principal!
 */
export function calculateAddOnRefund(
  input: AddOnRefundInput,
  nowDate: Date = new Date()
): AddOnRefundEstimate {
  const rule = STATE_AUTO_RULES[input.stateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const purchaseDate = new Date(input.purchaseDateIso || nowDate.toISOString());
  const msDiff = Math.max(0, nowDate.getTime() - (Number.isNaN(purchaseDate.getTime()) ? nowDate.getTime() : purchaseDate.getTime()));
  const daysSincePurchase = Math.floor(msDiff / (1000 * 60 * 60 * 24));
  const monthsElapsed = Math.max(0, Math.round((daysSincePurchase / 30.4375) * 10) / 10);
  const milesDriven = Math.max(0, (Number(input.currentMileage) || 0) - (Number(input.purchaseMileage) || 0));
  const withinFreeLook = daysSincePurchase <= rule.vscFreeLookDays && !input.claimsFiled;

  const loanApr = Math.max(0, Number(input.loanAprPct) || 0);
  const loanTerm = Math.max(12, Math.min(96, Math.round(Number(input.loanTermMonths) || 60)));
  const remainingLoanMonths = Math.max(1, Math.round(loanTerm - monthsElapsed));

  const lines: AddOnRefundLineBreakdown[] = [];
  let totalAddOnsPaidUsd = 0;
  let estimatedPrincipalRefundUsd = 0;

  for (const item of input.items || []) {
    const cost = Math.max(0, Number(item.costUsd) || 0);
    if (cost <= 0) continue;
    totalAddOnsPaidUsd += cost;
    const contractTerm = Math.max(12, Number(item.contractTermMonths) || 60);

    if (item.type === 'paint_fabric' && daysSincePurchase > rule.vscFreeLookDays) {
      lines.push({
        label: item.label,
        originalCostUsd: cost,
        refundMode: 'DISPUTE_ONLY',
        estimatedRefundUsd: 0,
        adminFeeDeductedUsd: 0,
        note: 'Past free-look: check if sold as an appearance warranty contract (proratable) or dispute if misrepresented as mandatory.',
      });
      continue;
    }

    if (withinFreeLook) {
      lines.push({
        label: item.label,
        originalCostUsd: cost,
        refundMode: 'FULL_FREE_LOOK',
        estimatedRefundUsd: Math.round(cost),
        adminFeeDeductedUsd: 0,
        note: `Within ${rule.name}'s ${rule.vscFreeLookDays}-day free-look window (no claims) → eligible for 100% full refund!`,
      });
      estimatedPrincipalRefundUsd += Math.round(cost);
    } else {
      // Prorate by greater of time elapsed or mileage ratio (assuming ~1,000 mi/mo benchmark for VSC)
      const timeRatioUsed = Math.min(0.95, monthsElapsed / contractTerm);
      const mileRatioUsed =
        item.type === 'vsc' ? Math.min(0.95, milesDriven / Math.max(12000, contractTerm * 1000)) : 0;
      const usedRatio = Math.max(timeRatioUsed, mileRatioUsed);
      const grossProrated = cost * (1 - usedRatio);
      const fee = Math.min(rule.vscMaxAdminFeeUsd, Math.round(grossProrated));
      const netRefund = Math.max(0, Math.round(grossProrated - fee));

      lines.push({
        label: item.label,
        originalCostUsd: cost,
        refundMode: 'PRORATED',
        estimatedRefundUsd: netRefund,
        adminFeeDeductedUsd: fee,
        note: `~${Math.round((1 - usedRatio) * 100)}% unused term remaining minus ~$${fee} max admin fee.`,
      });
      estimatedPrincipalRefundUsd += netRefund;
    }
  }

  // Compound interest eliminated if the refund applies to an active auto loan principal
  let estimatedLoanInterestSavedUsd = 0;
  let estimatedMonthsCutFromLoan = 0;
  if (input.financedInLoan && estimatedPrincipalRefundUsd > 0 && loanApr > 0) {
    const pmtOnRefundSlice = monthlyPayment(estimatedPrincipalRefundUsd, loanApr, remainingLoanMonths);
    estimatedLoanInterestSavedUsd = Math.max(
      0,
      Math.round(pmtOnRefundSlice * remainingLoanMonths - estimatedPrincipalRefundUsd)
    );
    // Approximate months shaved off the back of a typical $32k loan (~$600/mo payment)
    estimatedMonthsCutFromLoan = Math.max(
      1,
      Math.round((estimatedPrincipalRefundUsd + estimatedLoanInterestSavedUsd) / 550)
    );
  }

  return {
    daysSincePurchase,
    monthsElapsed,
    milesDriven,
    withinFreeLook,
    stateFreeLookDays: rule.vscFreeLookDays,
    stateAdminFeeCapUsd: rule.vscMaxAdminFeeUsd,
    totalAddOnsPaidUsd: Math.round(totalAddOnsPaidUsd),
    estimatedPrincipalRefundUsd,
    estimatedLoanInterestSavedUsd,
    totalRecoverableValueUsd: estimatedPrincipalRefundUsd + estimatedLoanInterestSavedUsd,
    estimatedMonthsCutFromLoan,
    lines,
  };
}

export function generateCancellationTemplates(
  input: AddOnRefundInput,
  estimate: AddOnRefundEstimate
): {
  cancellationSubject: string;
  cancellationLetter: string;
  stallBusterSubject: string;
  stallBusterLetter: string;
  lenderCheckScript: string;
  checklist: string[];
} {
  const rule = STATE_AUTO_RULES[input.stateCode?.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const buyer = input.buyerName?.trim() || '[YOUR FULL NAME]';
  const dealer = input.dealerName?.trim() || '[DEALERSHIP NAME]';
  const rawAdmin = input.administratorName?.trim() || '';
  const matchedAdmin = FI_ADMINISTRATORS.find(
    (a) =>
      a.id === rawAdmin.toLowerCase() ||
      a.name.toLowerCase().includes(rawAdmin.toLowerCase()) ||
      rawAdmin.toLowerCase().includes(a.id)
  );
  const admin = matchedAdmin ? matchedAdmin.name : rawAdmin || '[PLAN ADMINISTRATOR NAME]';
  const adminRoutingBlock = matchedAdmin
    ? `Direct Administrator Mailing Address: ${matchedAdmin.cancellationAddress}\nAdministrator Phone / Reference: ${matchedAdmin.contactHint}\nBypass Guidance: ${matchedAdmin.directBypassTip}`
    : `Direct Administrator Routing: Mail/email to the Administrator Cancellations Dept. address printed on Page 1 or the Cancellation Clause of your VSC/GAP contract.`;
  const lender = input.lenderName?.trim() || '[AUTO LENDER / LIENHOLDER NAME]';
  const vehicle = input.vehicleYmm?.trim() || '[YEAR MAKE MODEL]';
  const vin = input.vin?.trim() || '[17-DIGIT VIN]';
  const contractNo = input.contractNumber?.trim() || '[CONTRACT / POLICY #]';
  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const itemListText = estimate.lines
    .map(
      (l, i) =>
        `${i + 1}. ${l.label} — Original Cost: $${l.originalCostUsd.toLocaleString()} (Est. ${
          l.refundMode === 'FULL_FREE_LOOK' ? '100% Free-Look' : 'Prorated'
        } Refund: ~$${l.estimatedRefundUsd.toLocaleString()})`
    )
    .join('\n');

  const refundDestination = input.financedInLoan
    ? `Because these products were financed, please remit the refund directly to my lienholder (${lender}) to be applied to my loan principal balance, and send written confirmation of the refund amount and check/EFT date to my email and mailing address.`
    : `Because these products were paid in cash / not financed, please issue the refund check directly to me at my address below.`;

  const cancellationSubject = `FORMAL NOTICE OF CANCELLATION & REFUND REQUEST — VIN: ${vin} (Contract #${contractNo})`;
  const cancellationLetter = `Date: ${todayStr}

TO: ${admin} (Cancellations Department)
${adminRoutingBlock}
CC: Finance & Insurance Director, ${dealer}
CC: ${input.financedInLoan ? `Lienholder / Loan Servicing, ${lender}` : 'Buyer Personal Records'}

RE: Immediate Written Cancellation of Optional F&I Ancillary Contract(s)
Buyer Name: ${buyer}
Vehicle: ${vehicle}
VIN: ${vin}
Purchase Date: ${input.purchaseDateIso || '[PURCHASE DATE]'}
Contract / Agreement Number(s): ${contractNo}
Current Odometer Reading (as of ${todayStr}): ${Number(input.currentMileage || 0).toLocaleString()} miles

Dear Cancellations Department & F&I Director,

Please accept this signed letter as my formal written notice to immediately cancel the following optional ancillary product(s) purchased on ${
    input.purchaseDateIso || '[PURCHASE DATE]'
  }:

${itemListText}

${
  estimate.withinFreeLook
    ? `This request is submitted within ${rule.name}'s ${rule.vscFreeLookDays}-day free-look period (${estimate.daysSincePurchase} days since purchase) with zero claims filed. Accordingly, I am requesting a 100% full refund with zero cancellation fee.`
    : `I am requesting the full unearned prorated refund calculated from the date of this written notice (${todayStr}) and the attested odometer reading above, subject to no more than ${rule.name}'s statutory administrative fee cap ($${rule.vscMaxAdminFeeUsd}).`
}

${refundDestination}

Please note that per my contract terms, written notice establishes my effective cancellation date. I do not need to appear in person at the dealership to finalize this cancellation. Please reply in writing within 5 business days confirming receipt and the exact refund calculation.

Sincerely,

______________________________
${buyer}
Email: [YOUR EMAIL]
Phone: [YOUR PHONE]
Address: [YOUR MAILING ADDRESS]

Attachments Included:
- Timestamped photo of current dashboard odometer (${Number(input.currentMileage || 0).toLocaleString()} miles)
- Copy of Contract Declaration / Retail Installment Page`;

  const stallBusterSubject = `SECOND NOTICE — OVERDUE F&I CANCELLATION REFUND (ESCALATION NOTICE) — VIN: ${vin}`;
  const stallBusterLetter = `Date: [DATE — 15 DAYS AFTER FIRST NOTICE]

TO: General Manager & F&I Director, ${dealer}
CC: Cancellations Department, ${admin}

RE: Unprocessed Written Cancellation Notice Originally Sent on ${todayStr}
VIN: ${vin} | Contract #: ${contractNo}

Dear General Manager,

On ${todayStr}, I submitted a signed written request (with odometer verification) to cancel my optional F&I add-on contract(s) totaling $${estimate.totalAddOnsPaidUsd.toLocaleString()} (estimated refund ~$${estimate.estimatedPrincipalRefundUsd.toLocaleString()}).

To date, I have not received written confirmation of cancellation processing or refund remittance to ${
    input.financedInLoan ? lender : 'my address'
  }. Under ${rule.name} consumer protection and service contract statutes, optional ancillary cancellations must be honored promptly upon written request without requiring an in-person dealership visit.

Please provide written confirmation of the refund check/EFT reference number within 5 business days. If this remains unresolved, I will submit a formal complaint with attached documentation to:
1. The Consumer Financial Protection Bureau (CFPB)
2. The ${rule.name} Department of Insurance (Service Contract Regulator)
3. The ${rule.name} Attorney General's Consumer Protection Division

I would prefer to resolve this smoothly and directly with your office this week.

Sincerely,
${buyer}`;

  const lenderCheckScript = `Hi ${lender} Servicing Team — I recently cancelled optional dealership add-ons (VSC/GAP) on Auto Loan #[LOAN #] for VIN ${vin}. An estimated refund of ~$${estimate.estimatedPrincipalRefundUsd.toLocaleString()} is being remitted by ${admin} / ${dealer}. Please confirm once received that 100% of this refund has been applied directly to my principal balance (not just advancing future payment dates) and send an updated payoff statement.`;

  const checklist = [
    'Take a clear, well-lit photo of your dashboard odometer showing current mileage right next to today\'s date.',
    'Print, sign, and scan the Cancellation Letter (or e-sign PDF) — send via email AND Certified Mail (Return Receipt) if the dealer refuses to reply by email.',
    `Send simultaneously to BOTH ${admin} (to lock in your effective cancellation date directly) AND the F&I Director at ${dealer}.`,
    'Set a 14-day calendar reminder: if no written confirmation arrives, send the Day-14 Dealer Stall-Buster Escalation Letter.',
    input.financedInLoan
      ? `Keep making your normal monthly payment until ${lender} confirms the principal reduction (refunds reduce total loan balance & cut months off the end, not your required monthly payment).`
      : 'Watch for your refund check within 30–45 days and verify the math against your contract proration formula.',
  ];

  return {
    cancellationSubject,
    cancellationLetter,
    stallBusterSubject,
    stallBusterLetter,
    lenderCheckScript,
    checklist,
  };
}
