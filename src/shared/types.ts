export type AuditVerticalId = 'freight' | 'auto' | 'home-bids';

export type FutureVerticalId = 'contracts' | 'housing';

export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type LlmProviderId = 'GEMINI' | 'GROQ' | 'OPENROUTER' | 'OLLAMA';

export interface AuditFinding {
  level: FindingSeverity;
  title: string;
  detail: string;
  estimatedImpactUsd: number | null;
}

export interface AuditLineItem {
  label: string;
  quotedAmount: string;
  benchmarkAmount: string;
  status: 'OVERCHARGED' | 'MISSING' | 'SUSPECT' | 'FAIR';
}

export interface VerticalPricingPlan {
  passSku: 'FREIGHT_PACK' | 'AUTO_PASS' | 'HOME_PASS';
  passName: string;
  passPriceUsd: number;
  passDescription: string;
  proSku: 'PRO_MONTHLY';
  proName: string;
  proPriceUsd: number;
  proDescription: string;
}

/**
 * Full internal audit payload stored in SQLite.
 * Locked fields (lockedFlags, counterOfferScript, negotiationChecklist) are
 * strictly stripped on the server until `isUnlocked === true`.
 */
export interface StoredAuditRecord {
  auditId: string;
  vertical: AuditVerticalId;
  createdUtc: string;
  fileName: string;
  mimeType: string;
  documentSummary: string;
  verdictLabel: string;
  verdictTone: 'high_risk' | 'moderate_risk' | 'fair';
  estimatedSavingsUsd: number;
  billedTotalUsd: number | null;
  fairRangeLabel: string;
  freeFlags: AuditFinding[];
  lockedFlags: AuditFinding[];
  lineItems: AuditLineItem[];
  counterOfferSubject: string;
  counterOfferScript: string;
  negotiationChecklist: string[];
  deterministicMetrics: Array<{ label: string; value: string }>;
  reasoningProvider: 'LLM_MULTIMODAL' | 'LLM_TEXT' | 'DETERMINISTIC_FALLBACK';
  llmProvider: LlmProviderId | null;
  modelUsed: string | null;
  isUnlocked: boolean;
  unlockedUtc: string | null;
  unlockMethod: 'STRIPE_CHECKOUT' | 'DEMO_UNLOCK' | null;
  stripeSessionId: string | null;
}

/** Public API response returned to the browser (enforces server-side paywall). */
export interface PublicAuditResponse {
  auditId: string;
  vertical: AuditVerticalId;
  createdUtc: string;
  fileName: string;
  documentSummary: string;
  verdictLabel: string;
  verdictTone: 'high_risk' | 'moderate_risk' | 'fair';
  estimatedSavingsUsd: number;
  billedTotalUsd: number | null;
  fairRangeLabel: string;
  freeFlags: AuditFinding[];
  lockedFlagsCount: number;
  lockedFlags: AuditFinding[]; // Empty array until unlocked!
  lineItems: AuditLineItem[];
  counterOfferSubject: string | null; // Null until unlocked!
  counterOfferScript: string | null; // Null until unlocked!
  negotiationChecklist: string[]; // Empty until unlocked!
  deterministicMetrics: Array<{ label: string; value: string }>;
  reasoningProvider: StoredAuditRecord['reasoningProvider'];
  llmProvider: LlmProviderId | null;
  modelUsed: string | null;
  isUnlocked: boolean;
  unlockedUtc: string | null;
  unlockMethod: StoredAuditRecord['unlockMethod'];
  pricing: VerticalPricingPlan;
  stripeLiveConfigured: boolean;
}

export interface LlmPoolCandidateStatus {
  id: string;
  provider: LlmProviderId;
  model: string;
  supportsVision: boolean;
  state: 'READY' | 'COOLDOWN';
  cooldownUntilUtc: string | null;
  lastErrorReason: string | null;
}

export interface LlmPoolStatusResponse {
  configuredCount: number;
  readyCount: number;
  activeCandidateId: string | null;
  candidates: LlmPoolCandidateStatus[];
}

export interface AnalyticsSummaryResponse {
  generatedUtc: string;
  totalAudits: number;
  totalUnlocked: number;
  conversionRatePct: number;
  totalEstimatedSavingsFlaggedUsd: number;
  waitlistCount: number;
  byVertical: Array<{
    vertical: AuditVerticalId;
    audits: number;
    unlocked: number;
    checkoutClicks: number;
    pdfDownloads: number;
    avgSavingsUsd: number;
  }>;
  recentEvents: Array<{
    id: number;
    created_utc: string;
    event_name: string;
    vertical: string;
    audit_id: string | null;
  }>;
}
