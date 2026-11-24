import assert from 'node:assert/strict';
import { AuditDatabase } from '../server/db.ts';
import {
  calculateAutoDeal,
  calculateFreightProfit,
  calculateHomeBidBenchmark,
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

async function runTests() {
  console.log('Running VantagePaths Audit Hub unit tests...');

  // 1. Freight deterministic profit & FSC math
  const freight = calculateFreightProfit({
    loadedMiles: 925,
    deadheadMiles: 75,
    mpg: 6.5,
    dieselPerGallon: 3.79,
    driverPayPerMile: 0.65,
    otherCostsUsd: 150,
    offeredRateUsd: 2950,
    billedInvoiceUsd: 3500,
    quotedFscPct: 39.5,
  });
  assert.equal(freight.totalMiles, 1000);
  assert.ok(freight.fuelCostUsd > 550 && freight.fuelCostUsd < 610);
  assert.ok(freight.netProfitUsd > 1400);
  assert.equal(freight.invoiceVarianceUsd, 550);
  assert.ok(freight.fscOverchargeUsd > 250, 'Should flag inflated 39.5% FSC');
  assert.equal(freight.verdict, 'PROFITABLE');

  // 2. Auto OTD, APR markup & Lease Money Factor math
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

  // 3. Home Bid benchmark & IRC checklist
  const home = calculateHomeBidBenchmark({
    projectType: 'roof',
    squareFeet: 2400,
    quotedUsd: 28950,
    regionTier: 'standard',
  });
  assert.equal(home.verdict, 'OVERPRICED');
  assert.ok(home.varianceFromHighUsd > 7000);
  assert.ok(home.mandatoryChecklist.length >= 4);

  // 4. Free-only LLM pool guard (must reject paid OpenRouter models!)
  const candidates = buildFreeLlmCandidates({
    GEMINI_API_KEY: 'test-gem',
    GEMINI_MODELS: 'gemini-3.1-flash-lite,gemini-4-hydrogen',
    OPENROUTER_API_KEY: 'test-or',
    OPENROUTER_MODELS: 'openai/gpt-4o,meta-llama/llama-3.3-70b-instruct:free',
  } as NodeJS.ProcessEnv);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].model, 'gemini-3.1-flash-lite');
  assert.equal(candidates[2].model, 'meta-llama/llama-3.3-70b-instruct:free');

  // 5. 429 Failover test
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

  // 6. Server-side Paywall Enforcement + SQLite Persistence + Analytics
  const db = new AuditDatabase(':memory:');
  try {
    const sample = getSampleAuditInput('freight');
    const lockedAudit = await runDocumentAudit({
      vertical: 'freight',
      fileName: sample.fileName,
      mimeType: 'text/plain',
      rawText: sample.rawText,
      db,
      llmOptions: {
        candidates: [], // force deterministic fallback cleanly
      },
    });

    // Must be locked initially — zero sensitive fields leaked!
    assert.equal(lockedAudit.isUnlocked, false);
    assert.equal(lockedAudit.freeFlags.length, 2);
    assert.ok(lockedAudit.lockedFlagsCount >= 2);
    assert.deepEqual(lockedAudit.lockedFlags, []);
    assert.equal(lockedAudit.counterOfferScript, null);
    assert.equal(lockedAudit.counterOfferSubject, null);
    assert.deepEqual(lockedAudit.negotiationChecklist, []);

    // Unlock via DB and verify full fields are returned
    const unlockedRecord = db.markAuditUnlocked({
      auditId: lockedAudit.auditId,
      method: 'STRIPE_CHECKOUT',
      stripeSessionId: 'cs_test_123',
    });
    assert.ok(unlockedRecord);
    const unlockedPublic = toPublicAuditResponse(unlockedRecord!, true);
    assert.equal(unlockedPublic.isUnlocked, true);
    assert.ok(unlockedPublic.lockedFlags.length >= 2);
    assert.ok((unlockedPublic.counterOfferScript || '').length > 50);
    assert.ok(unlockedPublic.negotiationChecklist.length >= 2);

    // Waitlist dedupe & Analytics summary
    const w1 = db.addWaitlistEntry('Founder@Example.com', 'contracts', 'SaaS renewals');
    const w2 = db.addWaitlistEntry('founder@example.com', 'contracts');
    assert.equal(w1.alreadyExists, false);
    assert.equal(w2.alreadyExists, true);

    const summary = db.getAnalyticsSummary();
    assert.equal(summary.totalAudits, 1);
    assert.equal(summary.totalUnlocked, 1);
    assert.equal(summary.conversionRatePct, 100);
    assert.equal(summary.waitlistCount, 1);
  } finally {
    db.close();
  }

  console.log('ALL VANTAGEPATHS AUDIT HUB TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
