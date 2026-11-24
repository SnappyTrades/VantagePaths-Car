import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import type { AuditVerticalId, StoredAuditRecord } from './src/shared/types.ts';
import { AuditDatabase } from './server/db.ts';
import { getLlmPoolStatus } from './server/llmRouter.ts';
import {
  AUTO_ADDONS_GUIDE,
  AUTO_CONSUMER_RESOURCES,
  calculateAddOnRefund,
  calculateFourSquareReverse,
  calculatePromoVsRebate,
  FI_ADMINISTRATORS,
  generateCancellationTemplates,
  STATE_AUTO_RULES,
} from './server/autoKnowledge.ts';
import {
  calculateAutoDeal,
  calculateFreightProfit,
  calculateHomeBidBenchmark,
  getSampleAuditInput,
  isStripeLiveConfigured,
  lookupFmcsaCarrier,
  runDocumentAudit,
  toPublicAuditResponse,
  VERTICAL_PRICING,
} from './server/auditEngine.ts';

const PORT = Number(process.env.PORT || 3000);
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_VERTICALS = new Set<AuditVerticalId>(['freight', 'auto', 'home-bids']);

function parseVertical(raw: unknown): AuditVerticalId | null {
  const val = String(raw || '').trim().toLowerCase() as AuditVerticalId;
  return ALLOWED_VERTICALS.has(val) ? val : null;
}

function getStripeClient(): Stripe | null {
  if (!isStripeLiveConfigured()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
}

function getStripePriceIdForSku(sku: string): string | null {
  const map: Record<string, string | undefined> = {
    FREIGHT_PACK: process.env.STRIPE_PRICE_FREIGHT_PACK,
    AUTO_PASS: process.env.STRIPE_PRICE_AUTO_PASS,
    HOME_PASS: process.env.STRIPE_PRICE_HOME_PASS,
    PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
  };
  const val = map[sku]?.trim() || '';
  return val.startsWith('price_') ? val : null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.originalname.toLowerCase().endsWith('.txt');
    if (ok) cb(null, true);
    else cb(new Error('Unsupported file type. Upload a PDF, photo (PNG/JPG/WEBP), CSV, or TXT file.'));
  },
});

async function startServer() {
  const app = express();
  const db = new AuditDatabase();

  // Stripe Webhook needs raw body before express.json()
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!stripe || !webhookSecret) {
        return res.status(400).json({ error: 'Stripe webhook not configured.' });
      }
      const sig = req.headers['stripe-signature'];
      if (typeof sig !== 'string') {
        return res.status(400).json({ error: 'Missing stripe-signature header.' });
      }
      try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const auditId = session.metadata?.auditId;
          const vertical = session.metadata?.vertical || 'unknown';
          if (auditId) {
            db.markAuditUnlocked({
              auditId,
              method: 'STRIPE_CHECKOUT',
              stripeSessionId: session.id,
            });
            db.logEvent({
              eventName: 'audit_unlocked',
              vertical,
              auditId,
              metadata: { source: 'webhook', sessionId: session.id },
            });
          }
        }
        return res.json({ received: true });
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Webhook signature verification failed.',
        });
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  // Health & LLM status
  app.get('/api/health', (_req, res) => {
    const llm = getLlmPoolStatus();
    res.json({
      status: 'ok',
      service: 'VantagePaths Audit Hub',
      stripeLiveConfigured: isStripeLiveConfigured(),
      llmConfiguredCount: llm.configuredCount,
      llmActiveCandidate: llm.activeCandidateId,
      utc: new Date().toISOString(),
    });
  });

  app.get('/api/llm/status', (_req, res) => {
    res.json(getLlmPoolStatus());
  });

  app.get('/api/sample/:vertical', (req, res) => {
    const vertical = parseVertical(req.params.vertical);
    if (!vertical) return res.status(400).json({ error: 'Invalid vertical.' });
    return res.json(getSampleAuditInput(vertical));
  });

  // Main Document Audit Endpoint (supports multipart file upload, pasted text, or 1-click sample)
  app.post('/api/audit', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const vertical = parseVertical(req.body?.vertical);
      if (!vertical) {
        return res.status(400).json({ error: 'Vertical must be freight, auto, or home-bids.' });
      }

      const useSample = req.body?.useSample === true || req.body?.useSample === 'true';
      const contextNote = typeof req.body?.contextNote === 'string' ? req.body.contextNote : '';
      let fileName = 'Pasted_Document.txt';
      let mimeType = 'text/plain';
      let rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
      let fileBuffer: Buffer | null = null;

      if (useSample) {
        if (vertical === 'auto' && req.body?.sampleVariant === 'signed-contract') {
          fileName = 'Sample_Signed_RISC_TILA_Contract.txt';
          rawText = `RETAIL INSTALLMENT SALE CONTRACT — SIMPLE FINANCE CHARGE (TRUTH-IN-LENDING DISCLOSURE)
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

NOTE: Buyer was told in the F&I office that the lender "strongly prefers" GAP and VSC for approval. All optional F&I contracts are within the 30-day free-look window with zero claims filed.`;
        } else {
          const sample = getSampleAuditInput(vertical);
          fileName = sample.fileName;
          rawText = sample.rawText;
        }
      } else if (req.file) {
        fileName = req.file.originalname || 'Uploaded_Document';
        mimeType = req.file.mimetype || 'application/octet-stream';
        const isTextLike =
          mimeType.startsWith('text/') ||
          fileName.toLowerCase().endsWith('.csv') ||
          fileName.toLowerCase().endsWith('.txt');
        if (isTextLike) {
          rawText = req.file.buffer.toString('utf8');
        } else {
          fileBuffer = req.file.buffer;
        }
      }

      if (!rawText.trim() && !fileBuffer) {
        return res.status(400).json({
          error: 'Upload a PDF/photo/CSV, paste quote text, or click "Try Sample Document".',
        });
      }

      const result = await runDocumentAudit({
        vertical,
        fileName,
        mimeType,
        rawText,
        fileBuffer,
        contextNote,
        db,
      });

      return res.json(result);
    } catch (err) {
      console.error('[API /api/audit] Error:', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Audit engine failed.',
      });
    }
  });

  app.get('/api/audit/:auditId', (req, res) => {
    const rec = db.getAudit(req.params.auditId);
    if (!rec) return res.status(404).json({ error: 'Audit not found.' });
    return res.json(toPublicAuditResponse(rec));
  });

  // Billing: Create Stripe Checkout Session (or signal local Demo Unlock mode when Stripe isn't configured)
  app.post('/api/billing/checkout', async (req, res) => {
    try {
      const auditId = String(req.body?.auditId || '').trim();
      const tier = req.body?.tier === 'pro' ? 'pro' : 'pass';
      const rec = db.getAudit(auditId);
      if (!rec) return res.status(404).json({ error: 'Audit record not found.' });

      const plan = VERTICAL_PRICING[rec.vertical];
      const sku = tier === 'pro' ? plan.proSku : plan.passSku;
      const unitAmountCents = (tier === 'pro' ? plan.proPriceUsd : plan.passPriceUsd) * 100;
      const productName = tier === 'pro' ? plan.proName : plan.passName;
      const productDesc = tier === 'pro' ? plan.proDescription : plan.passDescription;

      db.logEvent({
        eventName: 'checkout_clicked',
        vertical: rec.vertical,
        auditId: rec.auditId,
        metadata: { tier, sku, priceUsd: unitAmountCents / 100 },
      });

      const stripe = getStripeClient();
      if (!stripe) {
        return res.json({
          mode: 'demo',
          demoUnlockAllowed: true,
          message: 'STRIPE_SECRET_KEY is not set in .env — Demo Unlock mode is enabled for testing.',
        });
      }

      const configuredPriceId = getStripePriceIdForSku(sku);
      const returnPath = `/${rec.vertical}`;
      const session = await stripe.checkout.sessions.create({
        mode: tier === 'pro' ? 'subscription' : 'payment',
        line_items: configuredPriceId
          ? [{ price: configuredPriceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: 'usd',
                  unit_amount: unitAmountCents,
                  product_data: {
                    name: `VantagePaths — ${productName}`,
                    description: productDesc,
                  },
                  ...(tier === 'pro' ? { recurring: { interval: 'month' } } : {}),
                },
                quantity: 1,
              },
            ],
        metadata: {
          auditId: rec.auditId,
          vertical: rec.vertical,
          sku,
        },
        success_url: `${APP_URL}${returnPath}?unlocked=1&audit_id=${encodeURIComponent(
          rec.auditId
        )}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}${returnPath}?audit_id=${encodeURIComponent(rec.auditId)}&canceled=1`,
      });

      return res.json({
        mode: 'stripe',
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (err) {
      console.error('[API /api/billing/checkout] Error:', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to start checkout.',
      });
    }
  });

  // Billing: Verify Stripe session on redirect return
  app.get('/api/billing/verify', async (req, res) => {
    try {
      const sessionId = String(req.query.session_id || '').trim();
      const auditId = String(req.query.audit_id || '').trim();
      if (!sessionId || !auditId) {
        return res.status(400).json({ error: 'session_id and audit_id are required.' });
      }
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(400).json({ error: 'Stripe is not configured on this server.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const isPaid =
        session.payment_status === 'paid' ||
        session.status === 'complete' ||
        session.payment_status === 'no_payment_required';

      if (!isPaid || session.metadata?.auditId !== auditId) {
        return res.status(402).json({ error: 'Checkout session is not paid for this audit.' });
      }

      const unlocked = db.markAuditUnlocked({
        auditId,
        method: 'STRIPE_CHECKOUT',
        stripeSessionId: session.id,
      });
      if (!unlocked) return res.status(404).json({ error: 'Audit not found.' });

      db.logEvent({
        eventName: 'audit_unlocked',
        vertical: unlocked.vertical,
        auditId: unlocked.auditId,
        metadata: { source: 'verify_redirect', sessionId: session.id },
      });

      return res.json(toPublicAuditResponse(unlocked));
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Stripe verification failed.',
      });
    }
  });

  // Billing: Local Demo Unlock (strictly disabled when STRIPE_SECRET_KEY is configured!)
  app.post('/api/billing/demo-unlock', (req, res) => {
    if (isStripeLiveConfigured()) {
      return res.status(403).json({ error: 'Demo unlock is disabled when live Stripe billing is active.' });
    }
    const auditId = String(req.body?.auditId || '').trim();
    const unlocked = db.markAuditUnlocked({
      auditId,
      method: 'DEMO_UNLOCK',
      stripeSessionId: 'demo_local',
    });
    if (!unlocked) return res.status(404).json({ error: 'Audit not found.' });

    db.logEvent({
      eventName: 'audit_unlocked',
      vertical: unlocked.vertical,
      auditId: unlocked.auditId,
      metadata: { source: 'demo_unlock' },
    });

    return res.json(toPublicAuditResponse(unlocked));
  });

  // Free SEO Calculators + FMCSA lookup
  app.post('/api/calculators/freight', (req, res) => {
    const result = calculateFreightProfit(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'freight' });
    res.json(result);
  });

  app.get('/api/calculators/fmcsa/:dotOrMc', async (req, res) => {
    const data = await lookupFmcsaCarrier(req.params.dotOrMc);
    res.json(data);
  });

  app.post('/api/calculators/auto', (req, res) => {
    const result = calculateAutoDeal(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto' });
    res.json(result);
  });

  app.post('/api/calculators/home-bids', (req, res) => {
    const result = calculateHomeBidBenchmark(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'home-bids' });
    res.json(result);
  });

  // Auto Advantage Hub — Informational Reference, Before/During/After Engines & Paywalled Self-Service Cancellation Kit
  app.get('/api/auto/reference', (_req, res) => {
    res.json({
      addons: AUTO_ADDONS_GUIDE,
      states: Object.values(STATE_AUTO_RULES),
      administrators: FI_ADMINISTRATORS,
      resources: AUTO_CONSUMER_RESOURCES,
    });
  });

  app.post('/api/auto/four-square', (req, res) => {
    const result = calculateFourSquareReverse(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto', metadata: { tool: 'four_square' } });
    res.json(result);
  });

  app.post('/api/auto/path-compare', (req, res) => {
    const result = calculatePromoVsRebate(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto', metadata: { tool: 'path_compare' } });
    res.json(result);
  });

  app.post('/api/auto/refund-kit', (req, res) => {
    const input = req.body || {};
    const estimate = calculateAddOnRefund(input);
    const templates = generateCancellationTemplates(input, estimate);
    const auditId = `vp_autorefund_${crypto.randomBytes(5).toString('hex')}`;
    const createdUtc = new Date().toISOString();

    const stored: StoredAuditRecord = {
      auditId,
      vertical: 'auto',
      createdUtc,
      fileName: 'Self-Service F&I Add-On Cancellation Kit',
      mimeType: 'application/json',
      documentSummary: `Self-service informational cancellation & refund calculation for ${estimate.lines.length} optional F&I add-on(s) totaling $${estimate.totalAddOnsPaidUsd.toLocaleString()} (${estimate.daysSincePurchase} days since purchase).`,
      verdictLabel: estimate.withinFreeLook
        ? `100% Free-Look Refund Eligible (~$${estimate.totalRecoverableValueUsd.toLocaleString()} Total Value)`
        : `Prorated Refund Eligible (~$${estimate.totalRecoverableValueUsd.toLocaleString()} Total Value)`,
      verdictTone: estimate.totalRecoverableValueUsd > 1500 ? 'high_risk' : 'moderate_risk',
      estimatedSavingsUsd: estimate.totalRecoverableValueUsd,
      billedTotalUsd: estimate.totalAddOnsPaidUsd,
      fairRangeLabel: `~$${estimate.estimatedPrincipalRefundUsd.toLocaleString()} Refund + ~$${estimate.estimatedLoanInterestSavedUsd.toLocaleString()} Interest Saved`,
      freeFlags: [
        {
          level: 'CRITICAL',
          title: estimate.withinFreeLook
            ? `Inside ${estimate.stateFreeLookDays}-Day Free-Look Window (100% Refund)`
            : `Prorated Cancellation Eligible (Max ~$${estimate.stateAdminFeeCapUsd} Fee Cap)`,
          detail: estimate.withinFreeLook
            ? `At ${estimate.daysSincePurchase} days since purchase with no claims filed, optional VSC/GAP/ancillary contracts generally qualify for a 100% refund with zero admin fee.`
            : `At ${estimate.monthsElapsed} months elapsed, unused contract time/mileage is refundable on a prorated basis directly to your loan principal (or to you if paid cash).`,
          estimatedImpactUsd: estimate.estimatedPrincipalRefundUsd,
        },
        {
          level: 'WARNING',
          title: input.financedInLoan
            ? `Eliminates ~$${estimate.estimatedLoanInterestSavedUsd.toLocaleString()} in Future Loan Interest`
            : 'Direct Cash Refund Opportunity (Not Financed)',
          detail: input.financedInLoan
            ? `Applying ~$${estimate.estimatedPrincipalRefundUsd.toLocaleString()} back to principal on your ${input.loanAprPct}% loan avoids ~$${estimate.estimatedLoanInterestSavedUsd.toLocaleString()} in compound interest and shaves roughly ${estimate.estimatedMonthsCutFromLoan} payments off the end of your loan.`
            : 'Because these add-ons were paid out of pocket, the administrator/dealer remits the refund check directly to you.',
          estimatedImpactUsd: estimate.estimatedLoanInterestSavedUsd,
        },
      ],
      lockedFlags: [
        {
          level: 'INFO',
          title: 'Day-14 Dealer Stall-Buster Escalation Letter Included',
          detail: `${templates.stallBusterSubject}\n\n${templates.stallBusterLetter}`,
          estimatedImpactUsd: null,
        },
        {
          level: 'INFO',
          title: 'Lender Principal-Application Verification Script Included',
          detail: templates.lenderCheckScript,
          estimatedImpactUsd: null,
        },
      ],
      lineItems: estimate.lines.map((l) => ({
        label: l.label,
        quotedAmount: `$${l.originalCostUsd.toLocaleString()}`,
        benchmarkAmount:
          l.refundMode === 'DISPUTE_ONLY'
            ? 'Check Contract / Dispute'
            : `~$${l.estimatedRefundUsd.toLocaleString()} Refund`,
        status: l.refundMode === 'DISPUTE_ONLY' ? 'SUSPECT' : 'OVERCHARGED',
      })),
      counterOfferSubject: templates.cancellationSubject,
      counterOfferScript: templates.cancellationLetter,
      negotiationChecklist: templates.checklist,
      deterministicMetrics: [
        { label: 'Est. Principal / Cash Refund', value: `$${estimate.estimatedPrincipalRefundUsd.toLocaleString()}` },
        { label: 'Est. Future Interest Saved', value: `$${estimate.estimatedLoanInterestSavedUsd.toLocaleString()}` },
        { label: 'Total Recoverable Value', value: `$${estimate.totalRecoverableValueUsd.toLocaleString()}` },
      ],
      reasoningProvider: 'DETERMINISTIC_FALLBACK',
      llmProvider: null,
      modelUsed: 'Deterministic Auto Refund Engine',
      isUnlocked: false,
      unlockedUtc: null,
      unlockMethod: null,
      stripeSessionId: null,
    };

    db.saveAudit(stored);
    db.logEvent({
      eventName: 'audit_completed',
      vertical: 'auto',
      auditId,
      metadata: { tool: 'refund_kit', estimatedSavingsUsd: stored.estimatedSavingsUsd },
    });

    return res.json({
      estimate,
      kit: toPublicAuditResponse(stored),
    });
  });

  // Funnel Analytics & Phase 2 Waitlist
  app.post('/api/analytics/event', (req, res) => {
    const allowed = new Set(['paywall_viewed', 'pdf_downloaded', 'script_copied', 'calculator_used']);
    const eventName = String(req.body?.eventName || '').trim();
    const vertical = String(req.body?.vertical || 'hub').trim().slice(0, 40);
    const auditId = typeof req.body?.auditId === 'string' ? req.body.auditId.slice(0, 64) : null;
    if (!allowed.has(eventName)) {
      return res.status(400).json({ error: 'Unsupported event name.' });
    }
    db.logEvent({ eventName, vertical, auditId });
    return res.json({ ok: true });
  });

  app.get('/api/analytics/summary', (_req, res) => {
    res.json(db.getAnalyticsSummary());
  });

  app.post('/api/waitlist', (req, res) => {
    const email = String(req.body?.email || '').trim();
    const vertical = String(req.body?.vertical || 'contracts').trim().slice(0, 40);
    const notes = String(req.body?.notes || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const { alreadyExists } = db.addWaitlistEntry(email, vertical, notes);
    db.logEvent({ eventName: 'waitlist_joined', vertical, metadata: { alreadyExists } });
    return res.json({
      ok: true,
      alreadyExists,
      message: alreadyExists
        ? `You're already on the early-access list for ${vertical}.`
        : `You're on the early-access list for ${vertical}!`,
    });
  });

  // Frontend Vite middleware (dev) or static dist (prod)
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[VantagePaths Hub] Running on ${APP_URL} (Stripe: ${
        isStripeLiveConfigured() ? 'LIVE' : 'DEMO_UNLOCK'
      }, Free LLM Pool: ${getLlmPoolStatus().configuredCount} models)`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start VantagePaths Hub:', err);
  process.exit(1);
});
