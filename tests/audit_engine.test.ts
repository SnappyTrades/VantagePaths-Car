import assert from 'node:assert/strict';
import { AuditDatabase } from '../server/db.ts';
import {
  calculateAutoDeal,
  getSampleAuditInput,
  runDocumentAudit,
  toPublicAuditResponse,
} from '../server/auditEngine.ts';
import {
  buildFreeLlmCandidates,
  clearLlmCooldowns,
  generateStructuredAuditWithFailover,
  getLlmPoolStatus,
} from '../server/llmRouter.ts';
import {
  AUTO_ADDONS_GUIDE,
  calculateAddOnRefund,
  calculateFourSquareReverse,
  calculatePromoVsRebate,
  generateCancellationTemplates,
  STATE_AUTO_RULES,
} from '../server/autoKnowledge.ts';
import {
  analyzeInsurancePolicy,
  calculateLoanRescueLtv,
  calculateOutOfStateSavings,
  calculateSellExitPaths,
  resolvePartnerUrl,
} from '../server/autoServices.ts';
import {
  buildMultiSiteDeepLinks,
  computeBuyerLeverageScore,
  searchVehicleInventory,
} from '../server/inventorySearch.ts';

async function runTests() {
  console.log('Running VantagePaths Car unit tests...');

  // 1. Auto OTD, APR markup & Lease Money Factor math
  const auto = calculateAutoDeal({
    sellingPriceUsd: 36485,
    dealerAddOnsUsd: 2789,
    docFeeUsd: 995,
    stateDocFeeCapUsd: 175,
    taxRatePct: 7.5,
    titleRegUsd: 350,
    downPaymentUsd: 4000,
    quotedAprPct: 8.89,
    benchmarkAprPct: 5.79,
    termMonths: 72,
    leaseMoneyFactor: 0.0032,
  });
  assert.equal(auto.excessDocFeeUsd, 820);
  assert.ok(auto.quotedOtdUsd > auto.fairOtdUsd + 3500);
  assert.ok(auto.aprMarkupInterestUsd > 3500, 'Should catch 3.1% APR markup');
  assert.equal(auto.equivalentLeaseAprPct, 7.68);

  // 2. Free-only LLM pool guard (must reject paid OpenRouter models!)
  const candidates = buildFreeLlmCandidates({
    GEMINI_API_KEY: 'test-gem',
    GEMINI_MODELS: 'gemini-3.1-flash-lite,gemini-4-hydrogen',
    OPENROUTER_API_KEY: 'test-or',
    OPENROUTER_MODELS: 'openai/gpt-4o,meta-llama/llama-3.3-70b-instruct:free',
  } as NodeJS.ProcessEnv);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].model, 'gemini-3.1-flash-lite');
  assert.equal(candidates[2].model, 'meta-llama/llama-3.3-70b-instruct:free');

  // 3. 429 Failover test
  clearLlmCooldowns();
  let calls = 0;
  const failoverRes = await generateStructuredAuditWithFailover(
    { systemInstruction: 'sys', userPrompt: 'usr' },
    {
      candidates: candidates.slice(0, 2),
      nowMs: 1_000_000,
      executor: async (c) => {
        calls++;
        if (c.model === 'gemini-3.1-flash-lite') {
          throw new Error('429 RESOURCE_EXHAUSTED');
        }
        return { text: '{"verdictLabel":"ok"}', usedVision: false };
      },
    }
  );
  assert.equal(calls, 2);
  assert.equal(failoverRes.model, 'gemini-4-hydrogen');
  const poolStatus = getLlmPoolStatus(
    { GEMINI_API_KEY: 'test-gem', GEMINI_MODELS: 'gemini-3.1-flash-lite,gemini-4-hydrogen' } as NodeJS.ProcessEnv,
    1_000_005
  );
  assert.equal(poolStatus.candidates[0].state, 'COOLDOWN');
  assert.equal(poolStatus.candidates[1].state, 'READY');
  clearLlmCooldowns();

  // 4. All 3 Auto Document Variants + Server-Side Paywall Enforcement + SQLite Persistence
  const db = new AuditDatabase(':memory:');
  try {
    for (const variant of ['otd', 'signed-contract', 'insurance-dec'] as const) {
      const sample = getSampleAuditInput(variant);
      const lockedAudit = await runDocumentAudit({
        docVariant: variant,
        fileName: sample.fileName,
        mimeType: 'text/plain',
        rawText: sample.rawText,
        db,
        llmOptions: { candidates: [] },
      });

      assert.equal(lockedAudit.isUnlocked, false);
      assert.equal(lockedAudit.freeFlags.length, 2);
      assert.ok(lockedAudit.lockedFlagsCount >= 2);
      assert.deepEqual(lockedAudit.lockedFlags, []);
      assert.equal(lockedAudit.counterOfferScript, null);
      assert.equal(lockedAudit.counterOfferSubject, null);
      assert.deepEqual(lockedAudit.negotiationChecklist, []);

      const unlockedRecord = db.markAuditUnlocked({
        auditId: lockedAudit.auditId,
        method: 'STRIPE_CHECKOUT',
        stripeSessionId: `cs_test_${variant}`,
      });
      assert.ok(unlockedRecord);
      const unlockedPublic = toPublicAuditResponse(unlockedRecord!, true);
      assert.equal(unlockedPublic.isUnlocked, true);
      assert.ok(unlockedPublic.lockedFlags.length >= 2);
      assert.ok((unlockedPublic.counterOfferScript || '').length > 50);
    }

    // Alert dedupe & Partner Click Attribution
    const w1 = db.addWaitlistEntry('Driver@Example.com', 'insurance-renewal', 'TX');
    const w2 = db.addWaitlistEntry('driver@example.com', 'insurance-renewal');
    assert.equal(w1.alreadyExists, false);
    assert.equal(w2.alreadyExists, true);

    db.logEvent({
      eventName: 'partner_click',
      vertical: 'auto',
      metadata: { partnerId: 'auto-refi-credit-union', estimatedEpcUsd: 4.5 },
    });

    const summary = db.getAnalyticsSummary();
    assert.equal(summary.totalAudits, 3);
    assert.equal(summary.totalUnlocked, 3);
    assert.equal(summary.partnerClicksTotal, 1);
    assert.equal(summary.projectedAffiliateRevenueUsd, 4.5);
    assert.equal(summary.waitlistCount, 1);

    // 5. Anti-Dealer Leverage Car Hunter + 6-Hour SQLite Inventory Cache
    const levHigh = computeBuyerLeverageScore({
      daysOnMarket: 82,
      priceDropCount: 3,
      priceDropTotalUsd: 2150,
      dealerDocFeeUsd: 225,
    });
    assert.equal(levHigh.label, 'HIGH LEVERAGE');
    assert.ok(levHigh.score >= 85);

    const links = buildMultiSiteDeepLinks({
      year: '2026',
      make: 'Toyota',
      model: 'RAV4',
      trim: 'XLE Premium',
      color: 'Black',
      zip: '75201',
      radiusMiles: 100,
      homeStateCode: 'TX',
    });
    assert.equal(links.length, 4);
    assert.ok(links[0].url.includes('sort=listed_at'));

    const inv = await searchVehicleInventory(
      {
        year: '2026',
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE Premium',
        color: 'Black',
        zip: '75201',
        radiusMiles: 100,
        homeStateCode: 'TX',
      },
      db,
      {} as NodeJS.ProcessEnv
    );
    assert.equal(inv.mode, 'PREVIEW_PLUS_DEEP_LINKS');
    assert.ok(inv.listings.length >= 4);

    db.setInventoryCache('test-key', { hello: 'world' }, 3600);
    assert.deepEqual(db.getInventoryCache('test-key')?.payload, { hello: 'world' });
  } finally {
    db.close();
  }

  // 6. 50-State Rules, Legal Decoder, 4-Square, Promo vs Rebate, Loan Rescue LTV, Insurance, Sell Exit
  assert.ok(Object.keys(STATE_AUTO_RULES).length >= 50);
  assert.equal(STATE_AUTO_RULES.CA.docFeeCapUsd, 85);
  assert.equal(STATE_AUTO_RULES.TX.docFeeCapUsd, 225);
  assert.ok(AUTO_ADDONS_GUIDE.some((a) => a.id === 'extended-warranty' && a.legallyRequired === 'OPTIONAL'));

  const fourSq = calculateFourSquareReverse({
    vehiclePriceUsd: 36500,
    downOrTradeUsd: 4000,
    salesTaxPct: 7.25,
    titleRegDocUsd: 550,
    termMonths: 72,
    dealerQuotedMonthlyUsd: 689,
    expectedFairAprPct: 5.9,
  });
  assert.equal(fourSq.verdict, 'HEAVY_PACKING');

  const pathCmp = calculatePromoVsRebate({
    vehiclePriceUsd: 38000,
    downPaymentUsd: 4000,
    tradeInValueUsd: 14000,
    tradeInPayoffUsd: 6000,
    stateCode: 'TX',
    termMonths: 60,
    promoAprPct: 1.9,
    cashRebateUsd: 3000,
    creditUnionAprPct: 5.79,
  });
  assert.equal(pathCmp.tradeInTaxSavingsUsd, 875);

  const refNow = new Date('2026-11-24T12:00:00Z');
  const rescue = calculateLoanRescueLtv(
    {
      purchaseDateIso: '2026-11-05',
      stateCode: 'TX',
      currentLoanBalanceUsd: 40500,
      estimatedVehicleValueUsd: 30500,
      financedInLoan: true,
      loanAprPct: 9.89,
      targetRefiAprPct: 5.99,
      loanTermMonths: 72,
      purchaseMileage: 40,
      currentMileage: 1150,
      claimsFiled: false,
      items: [
        { type: 'vsc', label: 'Extended Warranty', costUsd: 3495, contractTermMonths: 72 },
        { type: 'gap', label: 'GAP Waiver', costUsd: 1195, contractTermMonths: 72 },
        { type: 'tire_wheel', label: 'Tire & Wheel', costUsd: 895, contractTermMonths: 60 },
      ],
    },
    refNow
  );
  assert.equal(rescue.unlockedRefiEligibility, true);
  assert.ok(rescue.monthlyPaymentSavingsUsd > 120);

  const freeLook = calculateAddOnRefund(
    {
      purchaseDateIso: '2026-11-05',
      stateCode: 'TX',
      financedInLoan: true,
      loanAprPct: 8.89,
      loanTermMonths: 72,
      purchaseMileage: 50,
      currentMileage: 900,
      claimsFiled: false,
      items: [{ type: 'vsc', label: 'Extended Warranty', costUsd: 3495, contractTermMonths: 72 }],
    },
    refNow
  );
  const templates = generateCancellationTemplates(
    {
      purchaseDateIso: '2026-11-05',
      stateCode: 'TX',
      financedInLoan: true,
      loanAprPct: 8.89,
      loanTermMonths: 72,
      purchaseMileage: 50,
      currentMileage: 900,
      claimsFiled: false,
      items: [{ type: 'vsc', label: 'Extended Warranty', costUsd: 3495, contractTermMonths: 72 }],
      vin: '1HGCV1F30RA000001',
    },
    freeLook
  );
  assert.ok(templates.cancellationLetter.includes('1HGCV1F30RA000001'));

  const oos = calculateOutOfStateSavings({
    homeStateCode: 'FL',
    remoteStateCode: 'OH',
    localDealerPriceUsd: 37985,
    localAddOnsUsd: 2195,
    remoteDealerPriceUsd: 35600,
    shippingOrFlightCostUsd: 750,
  });
  assert.equal(oos.winner, 'REMOTE_BUY');

  const ins = analyzeInsurancePolicy({
    stateCode: 'TX',
    currentSixMonthPremiumUsd: 1248,
    priorSixMonthPremiumUsd: 985,
    biPdLimits: '100/300/100',
    collisionDeductibleUsd: 250,
    compDeductibleUsd: 250,
    hasRoadsideOnPolicy: true,
    hasRentalReimbursement: true,
    hasDealerGapCurrently: true,
  });
  assert.equal(ins.loyaltyPenaltyFlag, true);

  const sell = calculateSellExitPaths({
    stateCode: 'TX',
    dealerTradeInOfferUsd: 18500,
    instantCashOfferUsd: 18900,
    privatePartyValueUsd: 19200,
    loanPayoffUsd: 9500,
    buyingReplacementCar: true,
  });
  assert.equal(sell.bestPath, 'DEALER_TRADE');

  const partner = resolvePartnerUrl('auto-refi-credit-union', {
    AFFILIATE_AUTO_REFI_URL: 'https://impact.example.com/refi-track',
  } as NodeJS.ProcessEnv);
  assert.equal(partner?.targetUrl, 'https://impact.example.com/refi-track');

  console.log('ALL VANTAGEPATHS CAR TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
