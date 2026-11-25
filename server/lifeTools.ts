import crypto from 'node:crypto';
import type { AuditFinding, AuditLineItem, StoredAuditRecord } from '../src/shared/types.ts';

/**
 * VantagePaths "Life" verticals (Home, Money, Tech, Protect, Everyday Life).
 * Each tool follows the same rule as Auto:
 *   - The diagnostic math (savings, deadlines, benchmarks) is FREE.
 *   - Every generated letter, email, script & PDF is stored server-side and LOCKED
 *     until the $14 Single Kit / $29 60-Day Pass is unlocked.
 * All outputs are informational self-service templates the user reviews and sends themselves.
 */

export type LifeToolId =
  | 'home-internet'
  | 'money-apr'
  | 'tech-phone'
  | 'protect-dispute'
  | 'life-subscriptions';

export const LIFE_TOOL_IDS: LifeToolId[] = [
  'home-internet',
  'money-apr',
  'tech-phone',
  'protect-dispute',
  'life-subscriptions',
];

export interface LifeToolMetric {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'warn' | 'neutral';
}

export interface LifeToolFreeResult {
  toolId: LifeToolId;
  headline: string;
  metrics: LifeToolMetric[];
  flags: AuditFinding[];
}

export interface LifeToolOutput {
  result: LifeToolFreeResult;
  record: StoredAuditRecord;
}

const num = (v: unknown, fallback: number, min = 0, max = 10_000_000): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const str = (v: unknown, fallback: string, max = 90): string => {
  const s = String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  return s || fallback;
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

const round = (n: number): number => Math.round(n);

const todayLong = (d: Date): string =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function buildRecord(opts: {
  prefix: string;
  fileName: string;
  summary: string;
  verdict: string;
  tone: StoredAuditRecord['verdictTone'];
  savings: number;
  billed: number | null;
  fairRange: string;
  freeFlags: AuditFinding[];
  lockedFlags: AuditFinding[];
  lineItems: AuditLineItem[];
  subject: string;
  script: string;
  checklist: string[];
  metrics: LifeToolMetric[];
  model: string;
}): StoredAuditRecord {
  return {
    auditId: `${opts.prefix}_${crypto.randomBytes(5).toString('hex')}`,
    vertical: 'auto',
    createdUtc: new Date().toISOString(),
    fileName: opts.fileName,
    mimeType: 'application/json',
    documentSummary: opts.summary,
    verdictLabel: opts.verdict,
    verdictTone: opts.tone,
    estimatedSavingsUsd: Math.max(0, round(opts.savings)),
    billedTotalUsd: opts.billed,
    fairRangeLabel: opts.fairRange,
    freeFlags: opts.freeFlags,
    lockedFlags: opts.lockedFlags,
    lineItems: opts.lineItems,
    counterOfferSubject: opts.subject,
    counterOfferScript: opts.script,
    negotiationChecklist: opts.checklist,
    deterministicMetrics: opts.metrics.map((m) => ({ label: m.label, value: m.value })),
    reasoningProvider: 'DETERMINISTIC_FALLBACK',
    llmProvider: null,
    modelUsed: opts.model,
    isUnlocked: false,
    unlockedUtc: null,
    unlockMethod: null,
    stripeSessionId: null,
  };
}

/* =====================================================================
   HOME: Internet / Cable Bill Negotiator
===================================================================== */
function runHomeInternet(input: any, now: Date): LifeToolOutput {
  const provider = str(input.provider, 'Your internet provider');
  const currentMonthly = num(input.currentMonthlyUsd, 110, 0, 1000);
  const equipmentFee = num(input.equipmentFeeUsd, 15, 0, 100);
  const months = num(input.monthsAsCustomer, 30, 0, 600);
  const speed = num(input.speedMbps, 500, 10, 10_000);
  const competitorName = str(input.competitorName, 'a competing provider in my area');
  const competitorMonthly = num(input.competitorMonthlyUsd, 0, 0, 1000);
  const name = str(input.customerName, '[Your Name]');
  const account = str(input.accountNumber, '[Account #]', 40);
  const address = str(input.serviceAddress, '[Service Address]', 120);

  const speedBenchmark = speed <= 300 ? 50 : speed <= 500 ? 60 : speed <= 1000 ? 75 : 95;
  const benchmark = competitorMonthly > 0 ? Math.min(competitorMonthly, speedBenchmark + 15) : speedBenchmark;
  const totalCurrent = currentMonthly + equipmentFee;
  const monthlyOverpay = Math.max(0, totalCurrent - benchmark);
  const annualOverpay = monthlyOverpay * 12;
  const equipmentPaybackMonths = equipmentFee > 0 ? Math.ceil(150 / equipmentFee) : null;

  const flags: AuditFinding[] = [];
  if (months >= 12 && monthlyOverpay >= 15) {
    flags.push({
      level: 'CRITICAL',
      title: `Loyalty penalty: ~${usd(monthlyOverpay)}/mo above new-customer pricing`,
      detail: `After ${months} months, your ${usd(totalCurrent)}/mo all-in cost is well above the ~${usd(benchmark)}/mo benchmark for ${speed} Mbps. Promo pricing typically expires after 12–24 months, and providers rarely lower it unless you ask their retention team.`,
      estimatedImpactUsd: round(annualOverpay),
    });
  } else if (monthlyOverpay > 0) {
    flags.push({
      level: 'WARNING',
      title: `Paying ~${usd(monthlyOverpay)}/mo above benchmark`,
      detail: `Your all-in cost of ${usd(totalCurrent)}/mo is above the ~${usd(benchmark)}/mo benchmark for ${speed} Mbps service.`,
      estimatedImpactUsd: round(annualOverpay),
    });
  } else {
    flags.push({
      level: 'INFO',
      title: 'Your rate is already competitive',
      detail: `At ${usd(totalCurrent)}/mo you're at or below the ~${usd(benchmark)}/mo benchmark. Set a reminder to re-check when your promo period ends.`,
      estimatedImpactUsd: null,
    });
  }
  if (equipmentFee > 0) {
    flags.push({
      level: 'WARNING',
      title: `Equipment rental: ${usd(equipmentFee * 12)}/yr`,
      detail: `A compatible modem/router typically costs $100–$200 once. At ${usd(equipmentFee)}/mo, buying your own pays for itself in about ${equipmentPaybackMonths} months. Confirm compatibility on your provider's approved-device list first.`,
      estimatedImpactUsd: round(equipmentFee * 12),
    });
  }
  if (speed >= 1000) {
    flags.push({
      level: 'INFO',
      title: 'You may be paying for more speed than you use',
      detail: 'Most 1–4 person households stream, work and game comfortably on 300–500 Mbps. Dropping a tier is often the fastest win if retention won\'t budge.',
      estimatedImpactUsd: null,
    });
  }

  const savings = annualOverpay;
  const metrics: LifeToolMetric[] = [
    { label: 'Current All-In', value: `${usd(totalCurrent)}/mo`, tone: 'neutral' },
    { label: 'Benchmark', value: `~${usd(benchmark)}/mo`, tone: 'good' },
    { label: 'Monthly Overpay', value: `${usd(monthlyOverpay)}/mo`, tone: monthlyOverpay > 0 ? 'bad' : 'good' },
    { label: 'Est. Annual Savings', value: `~${usd(savings)}/yr`, tone: 'good' },
  ];

  const script = [
    todayLong(now),
    '',
    `To: ${provider} — Customer Retention / Loyalty Department`,
    `Re: Rate review request — Account ${account}`,
    `Service address: ${address}`,
    '',
    `Hello,`,
    '',
    `I have been a ${provider} customer for ${months} months and have always paid on time. My current bill is ${usd(currentMonthly)}/month plus ${usd(equipmentFee)}/month in equipment fees for ${speed} Mbps service.`,
    '',
    competitorMonthly > 0
      ? `${competitorName} is currently offering comparable service at my address for ${usd(competitorMonthly)}/month. I would prefer to stay with ${provider}, but I need my rate brought in line with current market pricing.`
      : `New customers at my address are currently being offered comparable ${speed} Mbps service for roughly ${usd(benchmark)}/month. I would prefer to stay with ${provider}, but I need my rate brought in line with current market pricing.`,
    '',
    `Specifically, I am requesting:`,
    `1. A rate of ${usd(benchmark)}/month (or lower) for my current speed tier, locked for at least 12 months.`,
    equipmentFee > 0 ? `2. Removal of the ${usd(equipmentFee)}/month equipment fee, or confirmation that I may use my own compatible equipment.` : `2. Confirmation of any loyalty credits or promotions available on my account.`,
    `3. Written confirmation of the new rate, term and any fees by email.`,
    '',
    `If we can't reach an agreement, please let me know the steps and any fees to close my account, as I will need to schedule a switch.`,
    '',
    `Thank you,`,
    name,
  ].join('\n');

  const record = buildRecord({
    prefix: 'vp_home',
    fileName: `${provider} Rate Negotiation Packet`,
    summary: `Internet bill review for ${provider}: ${usd(totalCurrent)}/mo all-in vs. ~${usd(benchmark)}/mo benchmark for ${speed} Mbps. Unlock the retention email, call script and switch checklist.`,
    verdict: savings > 0 ? `~${usd(savings)}/yr in internet overpayments identified` : 'Your internet rate is competitive',
    tone: savings >= 300 ? 'high_risk' : savings > 0 ? 'moderate_risk' : 'fair',
    savings,
    billed: round(totalCurrent * 12),
    fairRange: `~${usd(benchmark)}/mo for ${speed} Mbps`,
    freeFlags: flags.slice(0, 2),
    lockedFlags: [
      ...flags.slice(2),
      {
        level: 'INFO',
        title: 'Retention Call Script Included',
        detail: `CALL SCRIPT — say "cancel service" at the phone menu to reach retention.\n\n1. "Hi, I'm calling about account ${account}. I've been a customer for ${months} months and I'm reviewing my bill."\n2. "I'm paying ${usd(totalCurrent)} a month all-in. ${competitorMonthly > 0 ? `${competitorName} is offering ${usd(competitorMonthly)}.` : `New customers are getting about ${usd(benchmark)}.`} What can you do to keep me?"\n3. If they offer a partial discount: "I appreciate that. I'm looking for ${usd(benchmark)} including equipment. Is there a loyalty or retention offer that gets me there?"\n4. If no: "Okay. What would I owe to close the account, and what's the return process for equipment?" (This is often when the best offer appears.)\n5. Before hanging up: "Can you email me the new rate, the term length and the date it ends?"`,
        estimatedImpactUsd: null,
      },
    ],
    lineItems: [
      { label: 'Monthly service', quotedAmount: `${usd(currentMonthly)}/mo`, benchmarkAmount: `~${usd(Math.max(0, benchmark))}/mo`, status: currentMonthly > benchmark ? 'OVERCHARGED' : 'FAIR' },
      { label: 'Equipment rental', quotedAmount: `${usd(equipmentFee)}/mo`, benchmarkAmount: '$0 (own equipment)', status: equipmentFee > 0 ? 'SUSPECT' : 'FAIR' },
    ],
    subject: `Rate review request — Account ${account}`,
    script,
    checklist: [
      'Send the unlocked email through your provider\'s online chat or account messages so there is a written record.',
      'Call retention using the included script; ask for the offer in writing before agreeing.',
      'If no deal: confirm the competitor can install BEFORE cancelling, then return rented equipment and keep the receipt.',
      'Set a calendar reminder 30 days before your new rate expires to repeat this process.',
    ],
    metrics,
    model: 'VantagePaths Home: Internet Bill Negotiator',
  });

  return {
    result: {
      toolId: 'home-internet',
      headline: record.verdictLabel,
      metrics,
      flags: record.freeFlags,
    },
    record,
  };
}

/* =====================================================================
   MONEY: Credit Card APR Reduction & Fee Reversal
===================================================================== */
function runMoneyApr(input: any, now: Date): LifeToolOutput {
  const issuer = str(input.issuer, 'My card issuer');
  const balance = num(input.balanceUsd, 6500, 0, 500_000);
  const apr = num(input.currentAprPct, 27.99, 0, 60);
  const years = num(input.yearsAsCustomer, 4, 0, 60);
  const onTime = bool(input.onTimeLast12, true);
  const band = ['excellent', 'good', 'fair', 'rebuilding'].includes(input.creditBand) ? input.creditBand : 'good';
  const lateFee = num(input.lateFeeUsd, 0, 0, 100);
  const annualFee = num(input.annualFeeUsd, 0, 0, 1000);
  const name = str(input.customerName, '[Your Name]');
  const last4 = str(input.cardLast4, 'XXXX', 4);

  const reduction = onTime
    ? band === 'excellent' ? 8 : band === 'good' ? 6 : band === 'fair' ? 3 : 2
    : 2;
  const targetApr = Math.max(9.99, Math.round((apr - reduction) * 100) / 100);
  const interestNow = (balance * apr) / 100;
  const interestTarget = (balance * targetApr) / 100;
  const interestSaved = Math.max(0, interestNow - interestTarget);
  const feeRecovery = lateFee + annualFee * 0.5;
  const savings = interestSaved + feeRecovery;
  const btFee = balance * 0.04;
  const btSavings = Math.max(0, interestNow - btFee);

  const flags: AuditFinding[] = [];
  flags.push({
    level: apr >= 22 ? 'CRITICAL' : 'WARNING',
    title: `${apr}% APR costs ~${usd(interestNow)}/yr on a ${usd(balance)} balance`,
    detail: `A reduction to about ${targetApr}% would save ~${usd(interestSaved)}/yr. Issuers can and do lower rates for long-standing customers who ask — especially with ${onTime ? 'a clean 12-month payment history' : 'a plan to pay on time going forward'}.`,
    estimatedImpactUsd: round(interestSaved),
  });
  if (lateFee > 0) {
    flags.push({
      level: 'WARNING',
      title: `Request a ${usd(lateFee)} late fee reversal`,
      detail: 'One-time late fees are commonly waived as a courtesy when you have an otherwise good history. Ask in the same request.',
      estimatedImpactUsd: round(lateFee),
    });
  }
  if (balance >= 2000) {
    flags.push({
      level: 'INFO',
      title: `Backup plan: a 0% balance transfer could save ~${usd(btSavings)} in year one`,
      detail: `Typical balance-transfer fees run 3–5% (~${usd(btFee)} here). Only worth it if you can pay the balance down before the promo period ends.`,
      estimatedImpactUsd: round(btSavings),
    });
  }
  if (annualFee > 0) {
    flags.push({
      level: 'INFO',
      title: `Ask to waive or downgrade the ${usd(annualFee)} annual fee`,
      detail: 'Many issuers offer retention credits or a no-fee product change that keeps your account age (and credit history) intact.',
      estimatedImpactUsd: round(annualFee * 0.5),
    });
  }

  const metrics: LifeToolMetric[] = [
    { label: 'Interest Now', value: `${usd(interestNow)}/yr`, tone: 'bad' },
    { label: 'Target APR', value: `${targetApr}%`, tone: 'good' },
    { label: 'Interest Saved', value: `~${usd(interestSaved)}/yr`, tone: 'good' },
    { label: 'Total Est. Savings', value: `~${usd(savings)}/yr`, tone: 'good' },
  ];

  const script = [
    todayLong(now),
    '',
    `To: ${issuer} — Account Services`,
    `Re: Request for APR reduction${lateFee > 0 ? ' and fee reversal' : ''} — Card ending ${last4}`,
    '',
    'Hello,',
    '',
    `I have been a ${issuer} cardholder for ${years} year${years === 1 ? '' : 's'}${onTime ? ' and have made every payment on time over the past 12 months' : ''}. My current purchase APR is ${apr}%, and I am carrying a balance of approximately ${usd(balance)}.`,
    '',
    `I'm writing to request a reduction of my APR to ${targetApr}% or lower. At my current rate I am paying roughly ${usd(interestNow)} per year in interest, and I am actively evaluating balance-transfer offers from other issuers. I would prefer to keep my account and continue paying down my balance with ${issuer}.`,
    '',
    ...(lateFee > 0
      ? [`I also request a one-time courtesy reversal of the ${usd(lateFee)} late fee recently charged to my account.`, '']
      : []),
    ...(annualFee > 0
      ? [`Additionally, please let me know about any retention credit or no-annual-fee product change for which my account is eligible, in place of the ${usd(annualFee)} annual fee.`, '']
      : []),
    'Please confirm any changes in writing, including the new APR and the date it takes effect.',
    '',
    'Thank you for your consideration,',
    name,
  ].join('\n');

  const record = buildRecord({
    prefix: 'vp_money',
    fileName: `${issuer} APR Reduction & Fee Reversal Packet`,
    summary: `${apr}% APR on ${usd(balance)} costs ~${usd(interestNow)}/yr. Target ${targetApr}% saves ~${usd(interestSaved)}/yr. Unlock the written request, call script and balance-transfer decision guide.`,
    verdict: `~${usd(savings)}/yr in interest & fees you can ask to recover`,
    tone: savings >= 500 ? 'high_risk' : savings > 0 ? 'moderate_risk' : 'fair',
    savings,
    billed: round(interestNow),
    fairRange: `Target ~${targetApr}% APR`,
    freeFlags: flags.slice(0, 2),
    lockedFlags: [
      ...flags.slice(2),
      {
        level: 'INFO',
        title: 'APR Reduction Call Script Included',
        detail: `CALL SCRIPT — use the number on the back of your card.\n\n1. "Hi, I've been a cardholder for ${years} years and I'd like to request a lower interest rate on my card ending ${last4}."\n2. "I'm currently at ${apr}%. ${onTime ? 'I\'ve paid on time every month this year, and ' : ''}I'm considering a balance transfer elsewhere. Can you lower my APR to ${targetApr}%?"\n3. If they say no: "Is there a temporary promotional rate or hardship program available? Could you check again or transfer me to a supervisor?"\n${lateFee > 0 ? `4. "I'd also like to request a one-time courtesy reversal of the ${usd(lateFee)} late fee."\n` : ''}5. "Can you confirm the new rate and effective date in writing?"\n\nNote: Asking for a lower rate typically does not trigger a hard credit inquiry. If a representative says it requires a credit pull, you may decline and ask again later.`,
        estimatedImpactUsd: null,
      },
    ],
    lineItems: [
      { label: 'Purchase APR', quotedAmount: `${apr}%`, benchmarkAmount: `~${targetApr}%`, status: apr > targetApr ? 'OVERCHARGED' : 'FAIR' },
      ...(lateFee > 0 ? [{ label: 'Late fee', quotedAmount: usd(lateFee), benchmarkAmount: '$0 (courtesy reversal)', status: 'SUSPECT' as const }] : []),
      ...(annualFee > 0 ? [{ label: 'Annual fee', quotedAmount: usd(annualFee), benchmarkAmount: 'Retention credit / no-fee card', status: 'SUSPECT' as const }] : []),
    ],
    subject: `Request for APR reduction — Card ending ${last4}`,
    script,
    checklist: [
      'Send the unlocked request via your issuer\'s secure message center (creates a written record).',
      'Follow up by phone 3–5 business days later using the included call script.',
      'If declined, wait 60–90 days of on-time payments and ask again — or compare 0% balance-transfer offers.',
      'Keep the old card open after a product change or transfer to protect your credit history length.',
    ],
    metrics,
    model: 'VantagePaths Money: APR Reduction Builder',
  });

  return {
    result: { toolId: 'money-apr', headline: record.verdictLabel, metrics, flags: record.freeFlags },
    record,
  };
}

/* =====================================================================
   TECH: Cell Phone Plan Right-Sizer
===================================================================== */
function runTechPhone(input: any, now: Date): LifeToolOutput {
  const carrier = str(input.carrier, 'My wireless carrier');
  const lines = Math.round(num(input.lines, 3, 1, 12));
  const bill = num(input.monthlyBillUsd, 245, 0, 3000);
  const devicePayments = num(input.devicePaymentsUsd, 60, 0, 2000);
  const dataGb = num(input.avgDataGbPerLine, 8, 0, 500);
  const insurancePerLine = num(input.insurancePerLineUsd, 0, 0, 40);
  const years = num(input.yearsAsCustomer, 5, 0, 60);
  const name = str(input.customerName, '[Your Name]');
  const account = str(input.accountNumber, '[Account #]', 40);

  const service = Math.max(0, bill - devicePayments);
  const perLine = service / lines;
  const benchmarkPerLine = dataGb <= 5 ? 20 : dataGb <= 15 ? 30 : dataGb <= 40 ? 40 : 50;
  const benchmarkTotal = benchmarkPerLine * lines;
  const insuranceTotal = insurancePerLine * lines;
  const monthlyOverpay = Math.max(0, service - benchmarkTotal);
  const annualOverpay = monthlyOverpay * 12;

  const flags: AuditFinding[] = [];
  flags.push({
    level: monthlyOverpay >= 40 ? 'CRITICAL' : monthlyOverpay > 0 ? 'WARNING' : 'INFO',
    title:
      monthlyOverpay > 0
        ? `~${usd(perLine)}/line vs. ~${usd(benchmarkPerLine)}/line for your usage`
        : 'Your plan is already priced well for your usage',
    detail:
      monthlyOverpay > 0
        ? `Your lines average ${dataGb} GB/month. Plans on the same major networks (including carrier-owned prepaid brands and MVNOs) commonly run ~${usd(benchmarkPerLine)}/line at that usage — about ${usd(monthlyOverpay)}/mo less than you pay for service today.`
        : `At ~${usd(perLine)}/line for ${dataGb} GB/month you're at or below typical pricing.`,
    estimatedImpactUsd: monthlyOverpay > 0 ? round(annualOverpay) : null,
  });
  if (devicePayments > 0) {
    flags.push({
      level: 'WARNING',
      title: `Device payments (${usd(devicePayments)}/mo) can lock you in`,
      detail: 'If you switch carriers, remaining device balances usually become due and promotional bill credits stop. Negotiate with your current carrier first — or wait until devices are paid off before porting.',
      estimatedImpactUsd: null,
    });
  }
  if (insuranceTotal > 0) {
    flags.push({
      level: 'INFO',
      title: `Device protection: ${usd(insuranceTotal * 12)}/yr`,
      detail: `${usd(insurancePerLine)}/line adds up. Compare the deductible against a quality case + screen protector, a credit card with cell phone protection, or a manufacturer plan.`,
      estimatedImpactUsd: round(insuranceTotal * 12 * 0.6),
    });
  }
  if (dataGb <= 15 && perLine >= 45) {
    flags.push({
      level: 'INFO',
      title: 'You may be paying for "unlimited" you don\'t use',
      detail: `Using ${dataGb} GB/line, a tiered or lower unlimited plan usually covers you. Check each line's usage in your carrier app for the last 3 months before switching.`,
      estimatedImpactUsd: null,
    });
  }

  const savings = annualOverpay + (insuranceTotal > 0 ? insuranceTotal * 12 * 0.6 : 0);
  const metrics: LifeToolMetric[] = [
    { label: 'Service Cost', value: `${usd(service)}/mo`, tone: 'neutral' },
    { label: 'Per Line', value: `${usd(perLine)}/line`, tone: perLine > benchmarkPerLine ? 'bad' : 'good' },
    { label: 'Benchmark', value: `~${usd(benchmarkPerLine)}/line`, tone: 'good' },
    { label: 'Est. Annual Savings', value: `~${usd(savings)}/yr`, tone: 'good' },
  ];

  const script = [
    todayLong(now),
    '',
    `To: ${carrier} — Customer Loyalty / Retention`,
    `Re: Plan review — Account ${account} (${lines} line${lines === 1 ? '' : 's'})`,
    '',
    'Hello,',
    '',
    `I've been a ${carrier} customer for ${years} year${years === 1 ? '' : 's'}. I'm currently paying ${usd(bill)}/month, of which about ${usd(service)} is for service on ${lines} line${lines === 1 ? '' : 's'} — roughly ${usd(perLine)} per line. Our lines average ${dataGb} GB of data per month.`,
    '',
    `Plans on the same network are available for about ${usd(benchmarkPerLine)} per line at our usage level. Before I consider porting our numbers, I'd like to give ${carrier} the chance to match.`,
    '',
    'I am requesting:',
    `1. A plan change or loyalty discount bringing service to about ${usd(benchmarkTotal)}/month for all lines.`,
    '2. Removal of any add-ons or features we did not specifically request.',
    insuranceTotal > 0 ? `3. A review of device protection (${usd(insuranceTotal)}/month) and the options to remove it on select lines.` : '3. Confirmation of any autopay or loyalty credits available on my account.',
    '4. Written confirmation of the new monthly total and any effect on current device promotions.',
    '',
    'Thank you,',
    name,
  ].join('\n');

  const record = buildRecord({
    prefix: 'vp_tech',
    fileName: `${carrier} Phone Plan Right-Sizing Packet`,
    summary: `${lines}-line plan at ${usd(service)}/mo service (~${usd(perLine)}/line) vs. ~${usd(benchmarkPerLine)}/line benchmark for ${dataGb} GB/line. Unlock the retention request, chat script and safe-switch checklist.`,
    verdict: savings > 0 ? `~${usd(savings)}/yr in phone plan savings identified` : 'Your phone plan is competitively priced',
    tone: savings >= 400 ? 'high_risk' : savings > 0 ? 'moderate_risk' : 'fair',
    savings,
    billed: round(bill * 12),
    fairRange: `~${usd(benchmarkPerLine)}/line for ${dataGb} GB`,
    freeFlags: flags.slice(0, 2),
    lockedFlags: [
      ...flags.slice(2),
      {
        level: 'INFO',
        title: 'Safe Number-Port Checklist Included',
        detail: `HOW TO SWITCH WITHOUT LOSING YOUR NUMBERS\n\n1. Do NOT cancel ${carrier} first — porting your number to the new carrier cancels the old line automatically.\n2. Get your account number and a Number Transfer PIN from your ${carrier} app or account page.\n3. Check remaining device balances; pay off or confirm the new carrier will cover them.\n4. Confirm your phones are unlocked and compatible with the new network.\n5. Port one line first, test calls/texts/data for 24 hours, then port the remaining lines.\n6. Keep your last ${carrier} bill and confirm a $0 final balance.`,
        estimatedImpactUsd: null,
      },
    ],
    lineItems: [
      { label: `Service (${lines} lines)`, quotedAmount: `${usd(service)}/mo`, benchmarkAmount: `~${usd(benchmarkTotal)}/mo`, status: service > benchmarkTotal ? 'OVERCHARGED' : 'FAIR' },
      ...(insuranceTotal > 0 ? [{ label: 'Device protection', quotedAmount: `${usd(insuranceTotal)}/mo`, benchmarkAmount: 'Optional', status: 'SUSPECT' as const }] : []),
    ],
    subject: `Plan review — Account ${account}`,
    script,
    checklist: [
      'Review each line\'s data usage for the last 3 months in your carrier app.',
      'Send the unlocked request via chat/account messages, or use it as your phone script with retention.',
      'If they won\'t match, follow the Safe Number-Port Checklist — never cancel before porting.',
      'Re-check your plan once a year or whenever a device is paid off.',
    ],
    metrics,
    model: 'VantagePaths Tech: Phone Plan Right-Sizer',
  });

  return {
    result: { toolId: 'tech-phone', headline: record.verdictLabel, metrics, flags: record.freeFlags },
    record,
  };
}

/* =====================================================================
   PROTECT: Charge Dispute & Refund Builder
===================================================================== */
const ISSUE_LABELS: Record<string, string> = {
  not_received: 'goods or services were not received',
  defective: 'the item was defective or damaged',
  not_as_described: 'the item or service was not as described',
  cancelled_still_charged: 'I cancelled but was still charged',
  double_charged: 'I was charged more than once / charged the wrong amount',
};

function runProtectDispute(input: any, now: Date): LifeToolOutput {
  const merchant = str(input.merchant, 'the merchant');
  const amount = num(input.amountUsd, 189, 0, 1_000_000);
  const method = input.paymentMethod === 'debit' ? 'debit' : 'credit';
  const issueKey = ISSUE_LABELS[input.issueType] ? input.issueType : 'not_received';
  const issueText = ISSUE_LABELS[issueKey];
  const issuer = str(input.cardIssuer, method === 'credit' ? 'My card issuer' : 'My bank');
  const name = str(input.customerName, '[Your Name]');
  const last4 = str(input.cardLast4, 'XXXX', 4);
  const order = str(input.orderNumber, '[Order / Confirmation #]', 60);
  const merchantContacted = bool(input.merchantContacted, false);

  const parseDate = (v: unknown, fallback: Date): Date => {
    const d = new Date(String(v || ''));
    return Number.isNaN(d.getTime()) ? fallback : d;
  };
  const purchaseDate = parseDate(input.purchaseDateIso, new Date(now.getTime() - 20 * 86_400_000));
  const statementDate = parseDate(input.statementDateIso, new Date(now.getTime() - 10 * 86_400_000));
  const deadline = new Date(statementDate.getTime() + 60 * 86_400_000);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
  const deadlineStr = todayLong(deadline);

  const flags: AuditFinding[] = [];
  if (daysLeft < 0) {
    flags.push({
      level: 'CRITICAL',
      title: `The 60-day written dispute window likely passed ${Math.abs(daysLeft)} days ago`,
      detail: `Based on a statement dated ${todayLong(statementDate)}, the window ended around ${deadlineStr}. You can still send the merchant demand letter and ask your ${method === 'credit' ? 'issuer' : 'bank'} for a courtesy review — many will still consider it.`,
      estimatedImpactUsd: round(amount),
    });
  } else {
    flags.push({
      level: daysLeft <= 14 ? 'CRITICAL' : 'WARNING',
      title: `${daysLeft} days left — send your written dispute by ${deadlineStr}`,
      detail:
        method === 'credit'
          ? `Under the Fair Credit Billing Act, billing-error disputes on credit cards should be sent in writing so the issuer receives them within 60 days after the statement showing the charge was sent. Your statement date: ${todayLong(statementDate)}.`
          : `For debit cards, report errors to your bank as soon as possible and within 60 days of the statement showing the charge. Merchant disputes on debit cards are handled under your bank's policies, so act quickly.`,
      estimatedImpactUsd: round(amount),
    });
  }
  flags.push({
    level: merchantContacted ? 'INFO' : 'WARNING',
    title: merchantContacted ? 'Good — you already contacted the merchant' : 'Contact the merchant first (and keep proof)',
    detail: merchantContacted
      ? 'Reference your earlier contact (date, method, case number) in your dispute. It strengthens your file.'
      : 'Card issuers typically expect a good-faith attempt to resolve the problem with the merchant first, especially for quality issues. Send the included merchant letter and give them a short deadline (e.g., 10 days).',
    estimatedImpactUsd: null,
  });
  if (method === 'debit') {
    flags.push({
      level: 'INFO',
      title: 'Debit card disputes carry fewer protections than credit',
      detail: 'Money leaves your account immediately and refund timelines depend on your bank. For future large or risky purchases, use a credit card.',
      estimatedImpactUsd: null,
    });
  }

  const metrics: LifeToolMetric[] = [
    { label: 'Disputed Amount', value: usd(amount), tone: 'neutral' },
    { label: 'Written Deadline', value: deadlineStr, tone: daysLeft < 0 ? 'bad' : daysLeft <= 14 ? 'warn' : 'good' },
    { label: 'Days Remaining', value: daysLeft < 0 ? 'Passed' : `${daysLeft} days`, tone: daysLeft <= 14 ? 'bad' : 'good' },
    { label: 'Payment Method', value: method === 'credit' ? 'Credit card' : 'Debit card', tone: method === 'credit' ? 'good' : 'warn' },
  ];

  const script = [
    todayLong(now),
    '',
    `To: ${issuer} — Billing Disputes`,
    `Re: Billing error dispute — ${method === 'credit' ? 'Card' : 'Debit card'} ending ${last4}`,
    '',
    'Hello,',
    '',
    `I am writing to dispute a charge of ${usd(amount)} from ${merchant}, posted on or about ${todayLong(purchaseDate)} and appearing on my statement dated ${todayLong(statementDate)}.`,
    '',
    `Reason for dispute: ${issueText}. Order/confirmation number: ${order}.`,
    '',
    merchantContacted
      ? `I attempted to resolve this directly with ${merchant} but the issue was not resolved. Details of my contact are attached.`
      : `I have contacted ${merchant} requesting a refund and have not received one. A copy of that request is attached.`,
    '',
    `I request that you remove the ${usd(amount)} charge and any related finance charges or fees from my account, and that you investigate this billing error.`,
    '',
    'Enclosed: copy of statement with the charge highlighted, receipt/order confirmation, and copies of my communication with the merchant.',
    '',
    'Sincerely,',
    name,
    `${method === 'credit' ? 'Card' : 'Debit card'} ending ${last4}`,
  ].join('\n');

  const record = buildRecord({
    prefix: 'vp_protect',
    fileName: `${merchant} Charge Dispute Packet`,
    summary: `${usd(amount)} ${method} card charge from ${merchant} (${issueText}). Written dispute deadline ~${deadlineStr} (${daysLeft < 0 ? 'passed' : `${daysLeft} days left`}). Unlock the issuer dispute letter, merchant demand letter and evidence checklist.`,
    verdict: daysLeft < 0 ? `Window likely passed — courtesy dispute for ${usd(amount)}` : `${usd(amount)} recoverable — ${daysLeft} days to file in writing`,
    tone: daysLeft <= 14 ? 'high_risk' : 'moderate_risk',
    savings: amount,
    billed: round(amount),
    fairRange: `Full refund of ${usd(amount)}`,
    freeFlags: flags.slice(0, 2),
    lockedFlags: [
      ...flags.slice(2),
      {
        level: 'INFO',
        title: 'Merchant Refund Demand Letter Included',
        detail: `${todayLong(now)}\n\nTo: ${merchant} — Customer Service\nRe: Refund request — Order ${order}\n\nOn ${todayLong(purchaseDate)} I was charged ${usd(amount)}. The problem: ${issueText}.\n\nPlease issue a full refund of ${usd(amount)} to my original payment method within 10 days of this letter. If I do not receive a refund or a satisfactory response by then, I will dispute the charge with my ${method === 'credit' ? 'card issuer' : 'bank'} and may file complaints with the appropriate consumer protection agencies.\n\nThank you,\n${name}`,
        estimatedImpactUsd: null,
      },
      {
        level: 'INFO',
        title: 'Evidence Checklist Included',
        detail: 'Gather before sending:\n• Statement page with the charge highlighted\n• Receipt, order confirmation or contract\n• Screenshots/emails showing the problem (tracking, photos of damage, cancellation confirmation)\n• Dated copies of every message to the merchant\n• Proof of return shipping (if you returned the item)\n\nSend disputes by your issuer\'s online dispute form AND by mail to the billing-error address on your statement (not the payment address). Keep copies of everything.',
        estimatedImpactUsd: null,
      },
    ],
    lineItems: [
      { label: `${merchant} charge`, quotedAmount: usd(amount), benchmarkAmount: '$0 (full refund)', status: 'SUSPECT' },
    ],
    subject: `Billing error dispute — ending ${last4}`,
    script,
    checklist: [
      merchantContacted ? 'Note the date and method of your earlier merchant contact.' : 'Send the Merchant Refund Demand Letter today and allow up to 10 days.',
      `Send the dispute letter so the ${method === 'credit' ? 'issuer' : 'bank'} receives it before ${deadlineStr} — use the billing-error address on your statement.`,
      'Also file through your issuer\'s online dispute form and save the confirmation number.',
      'Keep paying the rest of your bill; for credit cards you generally don\'t have to pay the disputed amount while it is investigated.',
      'If unresolved, you can submit a complaint to the CFPB (consumerfinance.gov/complaint).',
    ],
    metrics,
    model: 'VantagePaths Protect: Charge Dispute Builder',
  });

  return {
    result: { toolId: 'protect-dispute', headline: record.verdictLabel, metrics, flags: record.freeFlags },
    record,
  };
}

/* =====================================================================
   EVERYDAY LIFE: Subscription Cancellation Center
===================================================================== */
interface SubItem {
  name: string;
  category: string;
  monthlyUsd: number;
  rarelyUsed: boolean;
  cancel: boolean;
}

function runLifeSubscriptions(input: any, now: Date): LifeToolOutput {
  const rawItems: any[] = Array.isArray(input.items) ? input.items.slice(0, 30) : [];
  const items: SubItem[] = rawItems.map((it) => ({
    name: str(it?.name, 'Subscription', 50),
    category: str(it?.category, 'other', 20).toLowerCase(),
    monthlyUsd: num(it?.monthlyUsd, 0, 0, 1000),
    rarelyUsed: bool(it?.rarelyUsed, false),
    cancel: bool(it?.cancel, false),
  }));
  const name = str(input.customerName, '[Your Name]');
  const email = str(input.accountEmail, '[Account Email]', 80);

  const totalMonthly = items.reduce((s, i) => s + i.monthlyUsd, 0);
  const cancelList = items.filter((i) => i.cancel);
  const cancelMonthly = cancelList.reduce((s, i) => s + i.monthlyUsd, 0);
  const rarelyKept = items.filter((i) => i.rarelyUsed && !i.cancel);
  const rarelyKeptMonthly = rarelyKept.reduce((s, i) => s + i.monthlyUsd, 0);
  const streaming = items.filter((i) => i.category === 'streaming');
  const savings = cancelMonthly * 12;

  const flags: AuditFinding[] = [];
  flags.push({
    level: totalMonthly >= 100 ? 'CRITICAL' : 'WARNING',
    title: `${usd(totalMonthly)}/mo (${usd(totalMonthly * 12)}/yr) across ${items.length} subscriptions`,
    detail: cancelList.length
      ? `Cancelling the ${cancelList.length} you selected saves ${usd(cancelMonthly)}/mo — ${usd(savings)} per year.`
      : 'Select the subscriptions you want to cancel to see your savings and generate cancellation requests.',
    estimatedImpactUsd: round(savings) || null,
  });
  if (rarelyKept.length) {
    flags.push({
      level: 'WARNING',
      title: `${rarelyKept.length} rarely-used subscription${rarelyKept.length === 1 ? '' : 's'} still active (${usd(rarelyKeptMonthly * 12)}/yr)`,
      detail: `You marked ${rarelyKept.map((i) => i.name).join(', ')} as rarely used but kept them. Consider pausing or cancelling — most can be restarted any time.`,
      estimatedImpactUsd: round(rarelyKeptMonthly * 12),
    });
  }
  if (streaming.length >= 3) {
    flags.push({
      level: 'INFO',
      title: `${streaming.length} streaming services — try rotating`,
      detail: 'Keep one or two at a time and rotate monthly based on what you\'re watching. Your watch history and profiles are usually saved when you come back.',
      estimatedImpactUsd: null,
    });
  }

  const metrics: LifeToolMetric[] = [
    { label: 'Total Subscriptions', value: `${usd(totalMonthly)}/mo`, tone: 'neutral' },
    { label: 'Selected to Cancel', value: `${cancelList.length} of ${items.length}`, tone: 'neutral' },
    { label: 'Monthly Savings', value: `${usd(cancelMonthly)}/mo`, tone: 'good' },
    { label: 'Annual Savings', value: `${usd(savings)}/yr`, tone: 'good' },
  ];

  const blocks = (cancelList.length ? cancelList : items.slice(0, 1)).map((i, idx) => {
    const gym = i.category === 'fitness';
    return [
      `--- CANCELLATION ${idx + 1} OF ${Math.max(1, cancelList.length)}: ${i.name.toUpperCase()} ---`,
      `Subject: Cancellation request — ${i.name} account (${email})`,
      '',
      `Hello ${i.name} Support,`,
      '',
      `Please cancel my ${i.name} subscription associated with ${email}, effective immediately, and stop all future recurring charges (currently ${usd(i.monthlyUsd)}/month).`,
      '',
      'Please send written confirmation of the cancellation, including the date it takes effect and confirmation that no further charges will be made.',
      gym ? '\nNote: Many gym contracts require cancellation in writing — send this by certified mail with return receipt if their online process is unavailable, and keep your receipt.' : '',
      '',
      'Thank you,',
      name,
    ].join('\n');
  });

  const script = [todayLong(now), '', ...blocks.flatMap((b) => [b, ''])].join('\n');

  const record = buildRecord({
    prefix: 'vp_life',
    fileName: 'Subscription Cancellation Packet',
    summary: `${items.length} subscriptions totaling ${usd(totalMonthly)}/mo. ${cancelList.length} selected to cancel (${usd(savings)}/yr). Unlock ready-to-send cancellation emails for each, plus the renewal-trap checklist.`,
    verdict: savings > 0 ? `${usd(savings)}/yr freed up by cancelling ${cancelList.length} subscription${cancelList.length === 1 ? '' : 's'}` : `${usd(totalMonthly * 12)}/yr in subscriptions reviewed`,
    tone: savings >= 300 ? 'high_risk' : savings > 0 ? 'moderate_risk' : 'fair',
    savings,
    billed: round(totalMonthly * 12),
    fairRange: `Keep ${items.length - cancelList.length}, cancel ${cancelList.length}`,
    freeFlags: flags.slice(0, 2),
    lockedFlags: [
      ...flags.slice(2),
      {
        level: 'INFO',
        title: 'Renewal-Trap Prevention Checklist Included',
        detail: '• Cancel at least 48 hours before your next billing date — most services bill on the renewal day.\n• Screenshot the cancellation confirmation page and save confirmation emails.\n• Check app-store subscriptions separately (Apple: Settings > your name > Subscriptions; Google Play: Payments & subscriptions).\n• Watch your next statement; if you\'re charged after cancelling, dispute it with your card issuer.\n• For annual plans, ask whether a prorated refund is available.',
        estimatedImpactUsd: null,
      },
    ],
    lineItems: items.slice(0, 12).map((i) => ({
      label: i.name,
      quotedAmount: `${usd(i.monthlyUsd)}/mo`,
      benchmarkAmount: i.cancel ? '$0 (cancel)' : 'Keep',
      status: i.cancel ? 'OVERCHARGED' : i.rarelyUsed ? 'SUSPECT' : 'FAIR',
    })),
    subject: `Cancellation requests (${cancelList.length})`,
    script,
    checklist: [
      'Send each cancellation email from the address on the account (or paste it into the service\'s support chat).',
      'Save every confirmation email or screenshot.',
      'Check app-store subscriptions separately — they don\'t cancel through the service\'s website.',
      'Review your next card statement and dispute any charge made after cancellation.',
    ],
    metrics,
    model: 'VantagePaths Everyday Life: Subscription Center',
  });

  return {
    result: { toolId: 'life-subscriptions', headline: record.verdictLabel, metrics, flags: record.freeFlags },
    record,
  };
}

export function runLifeTool(toolId: string, input: any, now: Date = new Date()): LifeToolOutput | null {
  switch (toolId) {
    case 'home-internet':
      return runHomeInternet(input || {}, now);
    case 'money-apr':
      return runMoneyApr(input || {}, now);
    case 'tech-phone':
      return runTechPhone(input || {}, now);
    case 'protect-dispute':
      return runProtectDispute(input || {}, now);
    case 'life-subscriptions':
      return runLifeSubscriptions(input || {}, now);
    default:
      return null;
  }
}
