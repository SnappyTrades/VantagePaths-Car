import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import type { AutoDocVariant, StoredAuditRecord } from './src/shared/types.ts';
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
  analyzeInsurancePolicy,
  calculateLoanRescueLtv,
  calculateOutOfStateSavings,
  calculateSellExitPaths,
  lookupVinIntelligence,
  PARTNER_OFFERS,
  resolvePartnerUrl,
} from './server/autoServices.ts';
import { searchVehicleInventory } from './server/inventorySearch.ts';
import { runLifeTool } from './server/lifeTools.ts';
import {
  calculateAutoDeal,
  getSampleAuditInput,
  isStripeLiveConfigured,
  runDocumentAudit,
  toPublicAuditResponse,
  VERTICAL_PRICING,
} from './server/auditEngine.ts';

const PORT = Number(process.env.PORT || 3000);
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const IS_PROD = process.env.NODE_ENV === 'production';

// Lightweight in-memory IP rate limiter to protect free-tier AI & NHTSA/Inventory quotas
const rateBuckets = new Map<string, { count: number; resetMs: number }>();
function checkRateLimit(ip: string, bucket: string, maxPerMin: number): boolean {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetMs <= now) {
    rateBuckets.set(key, { count: 1, resetMs: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMin) return false;
  entry.count += 1;
  return true;
}

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'local';
}

function getStripeClient(): Stripe | null {
  if (!isStripeLiveConfigured()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
}

function getStripePriceIdForSku(sku: string): string | null {
  const map: Record<string, string | undefined> = {
    AUTO_PASS: process.env.STRIPE_PRICE_AUTO_PASS,
    CERTIFIED_MAIL: process.env.STRIPE_PRICE_CERTIFIED_MAIL,
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

  // Baseline security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Dynamic SEO robots.txt & sitemap.xml (indexes all 50 states + DC!)
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${APP_URL}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const corePaths = [
      '/',
      '/auto',
      '/auto/buy',
      '/auto/rescue',
      '/auto/insurance',
      '/auto/sell',
      '/auto/states',
      '/home',
      '/money',
      '/tech',
      '/protect',
      '/life',
    ];
    const statePaths = Object.keys(STATE_AUTO_RULES).map((code) => `/state/${code}`);
    const urls = [...corePaths, ...statePaths]
      .map((p) => `  <url><loc>${APP_URL}${p}</loc><changefreq>weekly</changefreq></url>`)
      .join('\n');
    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });

  // Stripe Webhook needs raw body before express.json()
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
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
        if (auditId) {
          db.markAuditUnlocked({
            auditId,
            method: 'STRIPE_CHECKOUT',
            stripeSessionId: session.id,
          });
          db.logEvent({
            eventName: 'audit_unlocked',
            vertical: 'auto',
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
  });

  app.use(express.json({ limit: '2mb' }));

  // Health & LLM status
  app.get('/api/health', (_req, res) => {
    const llm = getLlmPoolStatus();
    res.json({
      status: 'ok',
      service: 'VantagePaths Car Platform',
      stripeLiveConfigured: isStripeLiveConfigured(),
      llmConfiguredCount: llm.configuredCount,
      llmActiveCandidate: llm.activeCandidateId,
      utc: new Date().toISOString(),
    });
  });

  app.get('/api/llm/status', (_req, res) => {
    res.json(getLlmPoolStatus());
  });

  // Main Document Audit Endpoint (OTD Worksheet, Signed TILA Contract, or Insurance Declarations Page)
  app.post(
    '/api/audit',
    (req, res, next) => {
      if (!checkRateLimit(getClientIp(req), 'audit', 20)) {
        return res.status(429).json({ error: 'Too many audit requests. Please wait a moment and try again.' });
      }
      upload.single('file')(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const useSample = req.body?.useSample === true || req.body?.useSample === 'true';
        const rawVariant = String(req.body?.sampleVariant || '').trim();
        const docVariant: AutoDocVariant | undefined =
          rawVariant === 'signed-contract' || rawVariant === 'insurance-dec' || rawVariant === 'otd'
            ? rawVariant
            : undefined;
        const contextNote = typeof req.body?.contextNote === 'string' ? req.body.contextNote : '';

        let fileName = 'Pasted_Auto_Document.txt';
        let mimeType = 'text/plain';
        let rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
        let fileBuffer: Buffer | null = null;

        if (useSample) {
          const sample = getSampleAuditInput(docVariant || 'otd');
          fileName = sample.fileName;
          rawText = sample.rawText;
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
            error: 'Upload a PDF/photo/CSV, paste quote text, or click "Try Sample".',
          });
        }

        const result = await runDocumentAudit({
          vertical: 'auto',
          docVariant,
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
    }
  );

  app.get('/api/audit/:auditId', (req, res) => {
    const rec = db.getAudit(req.params.auditId);
    if (!rec) return res.status(404).json({ error: 'Audit not found.' });
    return res.json(toPublicAuditResponse(rec));
  });

  // Billing: Stripe Checkout Session (or local Demo Unlock mode when STRIPE_SECRET_KEY is unset)
  app.post('/api/billing/checkout', async (req, res) => {
    try {
      const auditId = String(req.body?.auditId || '').trim();
      const rawTier = String(req.body?.tier || 'pass');
      const tier: 'single' | 'pass' | 'pro' =
        rawTier === 'single' ? 'single' : rawTier === 'pro' ? 'pro' : 'pass';
      const rec = db.getAudit(auditId);
      if (!rec) return res.status(404).json({ error: 'Audit record not found.' });

      const plan = VERTICAL_PRICING.auto;
      const sku = tier === 'pro' ? plan.proSku : tier === 'single' ? 'SINGLE_GENERATOR' : plan.passSku;
      const unitAmountCents =
        (tier === 'pro' ? plan.proPriceUsd : tier === 'single' ? 14 : plan.passPriceUsd) * 100;
      const productName =
        tier === 'pro'
          ? plan.proName
          : tier === 'single'
          ? 'Single Self-Service Letter / Email Kit Unlock'
          : plan.passName;
      const productDesc =
        tier === 'pro'
          ? plan.proDescription
          : tier === 'single'
          ? 'Unlocks this generated email/letter packet, direct routing instructions & downloadable PDF.'
          : plan.passDescription;

      db.logEvent({
        eventName: 'checkout_clicked',
        vertical: 'auto',
        auditId: rec.auditId,
        metadata: { tier, sku, priceUsd: unitAmountCents / 100 },
      });

      const stripe = getStripeClient();
      if (!stripe) {
        return res.json({
          mode: 'demo',
          demoUnlockAllowed: true,
          tier,
          message: 'STRIPE_SECRET_KEY is not set in .env — Demo Unlock mode is enabled for testing.',
        });
      }

      const configuredPriceId = getStripePriceIdForSku(sku);
      const returnPath = rec.auditId.startsWith('vp_autorefund_')
        ? '/rescue'
        : rec.auditId.startsWith('vp_autoins_')
        ? '/insurance'
        : '/buy';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
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
                },
                quantity: 1,
              },
            ],
        metadata: {
          auditId: rec.auditId,
          vertical: 'auto',
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
        vertical: 'auto',
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
      vertical: 'auto',
      auditId: unlocked.auditId,
      metadata: { source: 'demo_unlock' },
    });

    return res.json(toPublicAuditResponse(unlocked));
  });

  // Billing: Redeem an already-unlocked $29 60-Day Pass across other generators
  app.post('/api/billing/redeem-pass', (req, res) => {
    const targetAuditId = String(req.body?.auditId || '').trim();
    const passAuditId = String(req.body?.passAuditId || '').trim();
    if (!targetAuditId || !passAuditId) {
      return res.status(400).json({ error: 'auditId and passAuditId are required.' });
    }
    const existingPass = db.getAudit(passAuditId);
    if (!existingPass || !existingPass.isUnlocked) {
      return res.status(402).json({ error: 'Active unlocked 60-Day Pass not found.' });
    }
    const unlocked = db.markAuditUnlocked({
      auditId: targetAuditId,
      method: existingPass.unlockMethod || 'STRIPE_CHECKOUT',
      stripeSessionId: existingPass.stripeSessionId,
    });
    if (!unlocked) return res.status(404).json({ error: 'Target kit not found.' });
    return res.json(toPublicAuditResponse(unlocked));
  });

  // Deterministic Auto Calculators & Reference Endpoints
  app.post('/api/calculators/auto', (req, res) => {
    const result = calculateAutoDeal(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto' });
    res.json(result);
  });

  // Public Reference: Exposes searchable provider names & free-look windows, while redacting
  // direct-bypass cancellation routing addresses & phone lines (unlocked inside paid Cancellation Kit!)
  app.get('/api/auto/reference', (_req, res) => {
    res.json({
      addons: AUTO_ADDONS_GUIDE,
      states: Object.values(STATE_AUTO_RULES),
      administrators: FI_ADMINISTRATORS.map((a) => ({
        id: a.id,
        name: a.name,
        products: a.products,
        freeLookWindow: a.freeLookWindow,
        requiredDocs: a.requiredDocs,
      })),
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

  app.post('/api/auto/search-inventory', async (req, res) => {
    if (!checkRateLimit(getClientIp(req), 'inventory', 30)) {
      return res.status(429).json({ error: 'Too many search requests. Please wait a moment.' });
    }
    try {
      const result = await searchVehicleInventory(req.body || {}, db);
      db.logEvent({
        eventName: 'calculator_used',
        vertical: 'auto',
        metadata: { tool: 'inventory_hunter', mode: result.mode, query: result.querySummary },
      });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Inventory search failed.',
      });
    }
  });

  app.get('/api/auto/vin/:vin', async (req, res) => {
    if (!checkRateLimit(getClientIp(req), 'vin', 30)) {
      return res.status(429).json({ error: 'Too many VIN lookups. Please wait a moment.' });
    }
    try {
      const data = await lookupVinIntelligence(req.params.vin);
      db.logEvent({ eventName: 'calculator_used', vertical: 'auto', metadata: { tool: 'vin_lookup', vin: data.vin } });
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid VIN.' });
    }
  });

  app.post('/api/auto/loan-rescue', (req, res) => {
    const input = req.body || {};
    const rescue = calculateLoanRescueLtv(input);
    const templates = generateCancellationTemplates(input, rescue.refundEstimate);
    const auditId = `vp_autorefund_${crypto.randomBytes(5).toString('hex')}`;
    const createdUtc = new Date().toISOString();

    const stored: StoredAuditRecord = {
      auditId,
      vertical: 'auto',
      createdUtc,
      fileName: 'VantagePaths 2-Step Loan Rescue & Cancellation Packet',
      mimeType: 'application/json',
      documentSummary: rescue.rescueHeadline,
      verdictLabel: rescue.unlockedRefiEligibility
        ? `LTV Drops ${rescue.currentLtvPct}% → ${rescue.newLtvPct}% (Unlocks Refinance!)`
        : `Recover ~$${rescue.combinedTotalSavingsUsd.toLocaleString()} Total (${
            rescue.monthlyPaymentSavingsUsd > 0 ? `Save ~$${rescue.monthlyPaymentSavingsUsd}/mo` : 'Principal Reduction'
          })`,
      verdictTone: 'high_risk',
      estimatedSavingsUsd: rescue.combinedTotalSavingsUsd,
      billedTotalUsd: rescue.refundEstimate.totalAddOnsPaidUsd,
      fairRangeLabel: `~$${rescue.refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()} Add-On Refund + ~$${rescue.monthlyPaymentSavingsUsd}/mo Refi Drop`,
      freeFlags: [
        {
          level: 'CRITICAL',
          title: `Step 1: Cancel $${rescue.refundEstimate.totalAddOnsPaidUsd.toLocaleString()} in Optional F&I Add-Ons`,
          detail: `Est. ~$${rescue.refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()} principal refund + ~$${rescue.refundEstimate.estimatedLoanInterestSavedUsd.toLocaleString()} avoided interest. Drops Loan-to-Value from ${rescue.currentLtvPct}% to ${rescue.newLtvPct}%.`,
          estimatedImpactUsd: rescue.refundEstimate.totalRecoverableValueUsd,
        },
        {
          level: 'WARNING',
          title: rescue.unlockedRefiEligibility
            ? `Step 2: Refinance Eligibility UNLOCKED (Save ~$${rescue.monthlyPaymentSavingsUsd}/mo)`
            : `Step 2: Refinance From ${input.loanAprPct}% → ${input.targetRefiAprPct || 5.99}%`,
          detail: `Once the principal refund posts, refinancing cuts your monthly payment from ~$${rescue.currentMonthlyPaymentUsd}/mo to ~$${rescue.newRefiMonthlyPaymentUsd}/mo.`,
          estimatedImpactUsd: rescue.refiInterestSavingsUsd,
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
      lineItems: rescue.refundEstimate.lines.map((l) => ({
        label: l.label,
        quotedAmount: `$${l.originalCostUsd.toLocaleString()}`,
        benchmarkAmount:
          l.refundMode === 'DISPUTE_ONLY' ? 'Check Contract' : `~$${l.estimatedRefundUsd.toLocaleString()} Refund`,
        status: l.refundMode === 'DISPUTE_ONLY' ? 'SUSPECT' : 'OVERCHARGED',
      })),
      counterOfferSubject: templates.cancellationSubject,
      counterOfferScript: templates.cancellationLetter,
      negotiationChecklist: templates.checklist,
      deterministicMetrics: [
        { label: 'LTV Before → After', value: `${rescue.currentLtvPct}% → ${rescue.newLtvPct}%` },
        { label: 'Est. Principal Refund', value: `$${rescue.refundEstimate.estimatedPrincipalRefundUsd.toLocaleString()}` },
        { label: 'Est. Refi Monthly Drop', value: `-$${rescue.monthlyPaymentSavingsUsd}/mo` },
      ],
      reasoningProvider: 'DETERMINISTIC_FALLBACK',
      llmProvider: null,
      modelUsed: 'Deterministic 2-Step Loan Rescue Engine',
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
      metadata: { tool: 'loan_rescue', estimatedSavingsUsd: stored.estimatedSavingsUsd },
    });

    return res.json({ rescue, kit: toPublicAuditResponse(stored) });
  });

  // Pillar 1: Paywalled Multi-Dealer Bid-War Email Generator (Round 1 + Round 2 + Express Pickup Script)
  app.post('/api/auto/bidwar-kit', (req, res) => {
    const body = req.body || {};
    const vehicle = String(body.targetVehicle || '2026 Toyota RAV4 Hybrid XLE').trim().slice(0, 120);
    const zip = String(body.zipCode || '75024').trim().slice(0, 10);
    const homeState = String(body.homeState || 'TX').toUpperCase().slice(0, 2);
    const stateRule = STATE_AUTO_RULES[homeState] ?? STATE_AUTO_RULES.TX;
    const bestDealer = String(body.bestDealerName || 'Competing Metro Dealership').trim().slice(0, 100);
    const bestOtd = Math.max(5000, Number(body.bestOtdUsd) || 38385);
    const highestOtd = Math.max(bestOtd, Number(body.highestOtdUsd) || bestOtd + 3200);
    const targetBeatOtd = Math.max(4500, bestOtd - 500);
    const estSavings = Math.max(850, highestOtd - targetBeatOtd);

    const round1Subject = `Ready to Buy This Week — Requesting Itemized Out-The-Door Quote (${vehicle})`;
    const round1Script = `Hi Internet Sales Manager,

I am ready to purchase a ${vehicle} within the next 7 days and already have outside financing pre-approved. I am contacting 5 dealerships in the ${stateRule.name} region by email only (no phone calls please) and will place a deposit with whichever store sends the cleanest written Out-The-Door (OTD) breakdown.

Please reply with an itemized OTD quote showing:
1. Vehicle Selling Price (before tax & fees)
2. Dealer-installed add-ons ($0 — I am declining paint/nitrogen/VIN etch/security packages)
3. Dealer Documentation Fee (${
      stateRule.docFeeCapUsd !== null
        ? `${stateRule.name} statutory cap: $${stateRule.docFeeCapUsd}`
        : 'please state exact doc/admin fee'
    })
4. Sales Tax (for ZIP ${zip}) & Government DMV Title/Registration
5. Total Out-The-Door Price + availability for remote e-signing / 15-minute express pickup or delivery

Thank you,
[Your Name]`;

    const round2Script = `Subject: Re: ${vehicle} — Ready to Place Deposit Today at $${targetBeatOtd.toLocaleString()} OTD

Hi [Sales Manager],

Thank you for sending your numbers. I currently hold a written clean OTD quote from ${bestDealer} at $${bestOtd.toLocaleString()} all-in with $0 in dealer add-ons.

If you can beat that at $${targetBeatOtd.toLocaleString()} Out-The-Door (zero optional add-ons) and email me the final itemized Buyer's Order & Truth-in-Lending contract PDF to review from home first, I will put down a deposit today and schedule an express sign-and-drive pickup (or home delivery).

Let me know by 5:00 PM today if you want to lock this deal in.

Best,
[Your Name]`;

    const auditId = `vp_autobid_${crypto.randomBytes(5).toString('hex')}`;
    const stored: StoredAuditRecord = {
      auditId,
      vertical: 'auto',
      createdUtc: new Date().toISOString(),
      fileName: `Remote 5-Dealer Bid-War Kit (${vehicle})`,
      mimeType: 'application/json',
      documentSummary: `Custom remote negotiation packet for ${vehicle} in ${stateRule.name} (ZIP ${zip}). Targets $${targetBeatOtd.toLocaleString()} clean OTD — ~$${estSavings.toLocaleString()} below highest dealer quote.`,
      verdictLabel: `Target Clean OTD: $${targetBeatOtd.toLocaleString()} (Save ~$${estSavings.toLocaleString()})`,
      verdictTone: 'high_risk',
      estimatedSavingsUsd: estSavings,
      billedTotalUsd: highestOtd,
      fairRangeLabel: `$${targetBeatOtd.toLocaleString()} – $${bestOtd.toLocaleString()} Clean OTD`,
      freeFlags: [
        {
          level: 'INFO',
          title: `${stateRule.name} Doc Fee Rule Applied Automatically`,
          detail:
            stateRule.docFeeCapUsd !== null
              ? `${stateRule.name} caps dealer documentation fees at $${stateRule.docFeeCapUsd} by statute.`
              : `${stateRule.name} has uncapped doc fees (~$${stateRule.typicalDocFeeUsd} avg) — scripts demand offsetting selling-price discounts.`,
          estimatedImpactUsd: null,
        },
      ],
      lockedFlags: [
        {
          level: 'CRITICAL',
          title: 'Round 2 "Beat My Lowest Quote" Closing Counter-Email Included',
          detail: round2Script,
          estimatedImpactUsd: 500,
        },
        {
          level: 'INFO',
          title: 'Pre-Delivery Final Contract Demand & 15-Minute Express Pickup Script',
          detail: `Hi [F&I Manager] — Before I drive over (or e-sign), please email the final Retail Installment Contract (TILA) PDF confirming $${targetBeatOtd.toLocaleString()} OTD, zero VSC/GAP/ancillary add-ons, and my agreed APR so pickup takes under 15 minutes.`,
          estimatedImpactUsd: null,
        },
      ],
      lineItems: [
        { label: 'Highest Quoted Dealer OTD', quotedAmount: `$${highestOtd.toLocaleString()}`, benchmarkAmount: `$${bestOtd.toLocaleString()} Best`, status: 'OVERCHARGED' },
        { label: 'Round 2 Target Counter-Offer', quotedAmount: `$${bestOtd.toLocaleString()}`, benchmarkAmount: `$${targetBeatOtd.toLocaleString()} Target`, status: 'FAIR' },
      ],
      counterOfferSubject: round1Subject,
      counterOfferScript: round1Script,
      negotiationChecklist: [
        'Send Round 1 BCC or individually to 5 dealership Internet Sales Managers within 100–200 miles.',
        'Log every reply in your VantagePaths Bid Board and refuse phone calls until an itemized OTD is emailed.',
        'Send Round 2 to the 2nd- and 3rd-lowest dealers — let them undercut your #1 quote by $500+.',
      ],
      deterministicMetrics: [
        { label: 'Best Current OTD', value: `$${bestOtd.toLocaleString()}` },
        { label: 'Round 2 Target OTD', value: `$${targetBeatOtd.toLocaleString()}` },
      ],
      reasoningProvider: 'DETERMINISTIC_FALLBACK',
      llmProvider: null,
      modelUsed: 'Bid-War Script Generator',
      isUnlocked: false,
      unlockedUtc: null,
      unlockMethod: null,
      stripeSessionId: null,
    };

    db.saveAudit(stored);
    db.logEvent({ eventName: 'audit_completed', vertical: 'auto', auditId, metadata: { tool: 'bidwar_kit' } });
    return res.json({ kit: toPublicAuditResponse(stored) });
  });

  app.post('/api/auto/out-of-state', (req, res) => {
    const result = calculateOutOfStateSavings(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto', metadata: { tool: 'out_of_state' } });
    res.json(result);
  });

  // Pillar 3: Zero-Spam Insurance Audit (Free Diagnostic Math + Paywalled Quote Spec & Retention Script!)
  app.post('/api/auto/insurance-audit', (req, res) => {
    const input = req.body || {};
    const full = analyzeInsurancePolicy(input);
    const auditId = `vp_autoins_${crypto.randomBytes(5).toString('hex')}`;

    const stored: StoredAuditRecord = {
      auditId,
      vertical: 'auto',
      createdUtc: new Date().toISOString(),
      fileName: 'Zero-Spam Auto Insurance Quote Spec & Retention Packet',
      mimeType: 'application/json',
      documentSummary: `Policy audit ($${full.annualPremiumUsd.toLocaleString()}/yr, ${
        full.renewalHikePct >= 0 ? `+${full.renewalHikePct}%` : `${full.renewalHikePct}%`
      } change). Unlocks your 1-page Apples-to-Apples Email Quote Request + Current Carrier Rate-Match Script.`,
      verdictLabel: `Est. ~$${full.estimatedAnnualTotalSavingsUsd.toLocaleString()}/yr Insurance Savings Identified`,
      verdictTone: full.loyaltyPenaltyFlag ? 'high_risk' : 'moderate_risk',
      estimatedSavingsUsd: full.estimatedAnnualTotalSavingsUsd,
      billedTotalUsd: full.annualPremiumUsd,
      fairRangeLabel: `Save ~$${full.estimatedAnnualTotalSavingsUsd.toLocaleString()}/yr Re-Shopping`,
      freeFlags: full.flags.slice(0, 2).map((f) => ({ ...f, estimatedImpactUsd: null })),
      lockedFlags: [
        ...full.flags.slice(2).map((f) => ({ ...f, estimatedImpactUsd: null })),
        {
          level: 'INFO',
          title: 'Current Insurer Retention / Rate-Match Call & Chat Script Included',
          detail: `Hi Policy Retention Team — My 6-month renewal jumped to $${
            input.currentSixMonthPremiumUsd || 1248
          } despite zero claims/tickets. Before I bind an identical ${
            input.biPdLimits || '100/300/100'
          } policy with an independent carrier, please re-rate my policy into your newest underwriting tier, remove carrier roadside, raise collision deductible to $1,000, and apply paid-in-full / defensive-driver discounts.`,
          estimatedImpactUsd: null,
        },
      ],
      lineItems: [
        { label: 'Annualized Renewal Spend', quotedAmount: `$${full.annualPremiumUsd.toLocaleString()}/yr`, benchmarkAmount: `~$${Math.max(600, full.annualPremiumUsd - full.estimatedAnnualTotalSavingsUsd).toLocaleString()}/yr`, status: 'OVERCHARGED' },
      ],
      counterOfferSubject: 'Apples-to-Apples Auto Insurance Quote Request (Email Only — No Phone Calls)',
      counterOfferScript: full.zeroSpamQuoteSpecText,
      negotiationChecklist: [
        'Email the unlocked 1-Page Quote Spec to 3 local independent insurance brokers (they shop 10+ carriers without selling your phone number).',
        'Ask your current insurer\'s Retention Department to re-tier your policy using the included script.',
        'Confirm new policy + ~$5/mo Loan/Lease Payoff (GAP) is active BEFORE cancelling your old policy or dealership GAP.',
      ],
      deterministicMetrics: [
        { label: 'Annual Spend', value: `$${full.annualPremiumUsd.toLocaleString()}/yr` },
        { label: 'Renewal Jump', value: `${full.renewalHikePct >= 0 ? '+' : ''}${full.renewalHikePct}%` },
        { label: 'Est. Annual Savings', value: `~$${full.estimatedAnnualTotalSavingsUsd.toLocaleString()}/yr` },
      ],
      reasoningProvider: 'DETERMINISTIC_FALLBACK',
      llmProvider: null,
      modelUsed: 'Insurance Spec Generator',
      isUnlocked: false,
      unlockedUtc: null,
      unlockMethod: null,
      stripeSessionId: null,
    };

    db.saveAudit(stored);
    db.logEvent({ eventName: 'audit_completed', vertical: 'auto', auditId, metadata: { tool: 'insurance_kit' } });

    // Strip zeroSpamQuoteSpecText from free response — strictly unlocked via fee!
    const { zeroSpamQuoteSpecText: _redacted, ...freeAnalysis } = full;
    res.json({
      ...freeAnalysis,
      kit: toPublicAuditResponse(stored),
    });
  });

  // VantagePaths Life Verticals (Home / Money / Tech / Protect / Everyday Life)
  // Free diagnostic math + server-locked generated letters (same fee rule as Auto).
  app.post('/api/life/:toolId', (req, res) => {
    if (!checkRateLimit(getClientIp(req), 'life', 30)) {
      return res.status(429).json({ error: 'Too many requests — please wait a minute and try again.' });
    }
    const out = runLifeTool(req.params.toolId, req.body || {});
    if (!out) return res.status(404).json({ error: 'Unknown tool.' });
    db.saveAudit(out.record);
    db.logEvent({
      eventName: 'audit_completed',
      vertical: 'auto',
      auditId: out.record.auditId,
      metadata: { tool: req.params.toolId },
    });
    return res.json({ result: out.result, kit: toPublicAuditResponse(out.record) });
  });

  app.post('/api/auto/sell-exit', (req, res) => {
    const result = calculateSellExitPaths(req.body || {});
    db.logEvent({ eventName: 'calculator_used', vertical: 'auto', metadata: { tool: 'sell_exit' } });
    res.json(result);
  });

  // Day-1 Revenue Layer 2: Tracked High-CPA Partner / Affiliate Outbound Engine
  app.get('/api/partner/offers', (_req, res) => {
    res.json({
      offers: PARTNER_OFFERS.map((o) => ({
        id: o.id,
        pillar: o.pillar,
        category: o.category,
        title: o.title,
        subtitle: o.subtitle,
        ctaLabel: o.ctaLabel,
        badge: o.badge,
        estimatedCpaUsd: o.estimatedCpaUsd,
        disclosure: o.disclosure,
        clickPath: `/api/partner/click/${o.id}`,
      })),
    });
  });

  app.get('/api/partner/click/:partnerId', (req, res) => {
    const resolved = resolvePartnerUrl(req.params.partnerId);
    if (!resolved) return res.status(404).json({ error: 'Unknown partner offer.' });
    db.logEvent({
      eventName: 'partner_click',
      vertical: 'auto',
      metadata: {
        partnerId: resolved.offer.id,
        pillar: resolved.offer.pillar,
        category: resolved.offer.category,
        estimatedEpcUsd: resolved.offer.estimatedEpcUsd,
        estimatedCpaUsd: resolved.offer.estimatedCpaUsd,
        source: String(req.query.source || 'web').slice(0, 40),
      },
    });
    return res.redirect(302, resolved.targetUrl);
  });

  // Funnel Analytics & Alert Capture
  app.post('/api/analytics/event', (req, res) => {
    const allowed = new Set(['paywall_viewed', 'pdf_downloaded', 'script_copied', 'calculator_used']);
    const eventName = String(req.body?.eventName || '').trim();
    const auditId = typeof req.body?.auditId === 'string' ? req.body.auditId.slice(0, 64) : null;
    if (!allowed.has(eventName)) {
      return res.status(400).json({ error: 'Unsupported event name.' });
    }
    db.logEvent({ eventName, vertical: 'auto', auditId });
    return res.json({ ok: true });
  });

  app.get('/api/analytics/summary', (req, res) => {
    const requiredToken = process.env.ADMIN_TOKEN?.trim();
    if (requiredToken) {
      const provided = String(req.headers['x-admin-token'] || req.query.token || '').trim();
      if (provided !== requiredToken) {
        return res.status(401).json({ error: 'Unauthorized: valid ADMIN_TOKEN required.' });
      }
    }
    return res.json(db.getAnalyticsSummary());
  });

  app.post('/api/waitlist', (req, res) => {
    const email = String(req.body?.email || '').trim();
    const vertical = String(req.body?.vertical || 'insurance-renewal').trim().slice(0, 40);
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
        ? "You're already subscribed to alerts for this item."
        : 'Alert saved — we will notify you with zero spam!',
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
      `[VantagePaths Car] Running on ${APP_URL} (Stripe: ${
        isStripeLiveConfigured() ? 'LIVE' : 'DEMO_UNLOCK'
      }, Free LLM Pool: ${getLlmPoolStatus().configuredCount} models)`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start VantagePaths Car:', err);
  process.exit(1);
});
