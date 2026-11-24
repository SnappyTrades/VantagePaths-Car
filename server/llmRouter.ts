import { GoogleGenAI } from '@google/genai';
import type {
  LlmPoolCandidateStatus,
  LlmPoolStatusResponse,
  LlmProviderId,
} from '../src/shared/types.ts';

export interface LlmCandidate {
  id: string;
  provider: LlmProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  supportsVision: boolean;
}

export interface LlmAuditRequest {
  systemInstruction: string;
  userPrompt: string;
  attachment?: {
    mimeType: string;
    base64Data: string;
  } | null;
  temperature?: number;
}

export interface LlmAuditResult {
  text: string;
  provider: LlmProviderId;
  model: string;
  usedVision: boolean;
}

export type LlmAuditExecutor = (
  candidate: LlmCandidate,
  req: LlmAuditRequest
) => Promise<{ text: string; usedVision: boolean }>;

interface CooldownEntry {
  cooldownUntilMs: number;
  reason: string;
}

const DEFAULT_GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
];
const DEFAULT_GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const DEFAULT_OPENROUTER_MODELS = ['openrouter/free'];
const MODEL_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.LLM_TIMEOUT_MS || '18000', 10) || 18000
);

const cooldownMap = new Map<string, CooldownEntry>();

function cleanKey(raw: string | undefined): string {
  const val = raw?.trim() || '';
  if (!val || val.startsWith('MY_')) return '';
  return val;
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : fallback;
}

/**
 * Strictly $0 free-tier multi-model & multi-provider failover chain:
 * 1. Gemini Free Tier (supports native PDF + image vision!)
 * 2. Groq Free Tier
 * 3. OpenRouter Free-Only (`openrouter/free` or `:free` enforced)
 * 4. Local Ollama
 */
export function buildFreeLlmCandidates(env: NodeJS.ProcessEnv = process.env): LlmCandidate[] {
  const list: LlmCandidate[] = [];

  const geminiKey = cleanKey(env.GEMINI_API_KEY);
  if (geminiKey) {
    const models = parseList(env.GEMINI_MODELS || env.GEMINI_MODEL, DEFAULT_GEMINI_MODELS);
    for (const model of models) {
      list.push({
        id: `GEMINI:${model}`,
        provider: 'GEMINI',
        model,
        apiKey: geminiKey,
        supportsVision: true,
      });
    }
  }

  const groqKey = cleanKey(env.GROQ_API_KEY);
  if (groqKey) {
    for (const model of parseList(env.GROQ_MODELS, DEFAULT_GROQ_MODELS)) {
      list.push({
        id: `GROQ:${model}`,
        provider: 'GROQ',
        model,
        apiKey: groqKey,
        baseUrl: 'https://api.groq.com/openai/v1',
        supportsVision: false,
      });
    }
  }

  const orKey = cleanKey(env.OPENROUTER_API_KEY);
  if (orKey) {
    const freeOnly = parseList(env.OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODELS).filter(
      (m) => m === 'openrouter/free' || m.endsWith(':free')
    );
    for (const model of freeOnly.length > 0 ? freeOnly : DEFAULT_OPENROUTER_MODELS) {
      list.push({
        id: `OPENROUTER:${model}`,
        provider: 'OPENROUTER',
        model,
        apiKey: orKey,
        baseUrl: 'https://openrouter.ai/api/v1',
        supportsVision: false,
      });
    }
  }

  const ollamaRaw = env.OLLAMA_MODELS?.trim() || env.OLLAMA_MODEL?.trim();
  if (ollamaRaw) {
    const baseUrl = (env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
    for (const model of parseList(ollamaRaw, [])) {
      list.push({
        id: `OLLAMA:${model}`,
        provider: 'OLLAMA',
        model,
        baseUrl,
        supportsVision: false,
      });
    }
  }

  return list;
}

export function clearLlmCooldowns(): void {
  cooldownMap.clear();
}

export function getLlmPoolStatus(
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now()
): LlmPoolStatusResponse {
  const candidates = buildFreeLlmCandidates(env);
  const statuses: LlmPoolCandidateStatus[] = candidates.map((c) => {
    const cd = cooldownMap.get(c.id);
    const cooling = Boolean(cd && cd.cooldownUntilMs > nowMs);
    return {
      id: c.id,
      provider: c.provider,
      model: c.model,
      supportsVision: c.supportsVision,
      state: cooling ? 'COOLDOWN' : 'READY',
      cooldownUntilUtc: cooling && cd ? new Date(cd.cooldownUntilMs).toISOString() : null,
      lastErrorReason: cooling && cd ? cd.reason : null,
    };
  });
  const active = statuses.find((s) => s.state === 'READY') ?? statuses[0] ?? null;
  return {
    configuredCount: statuses.length,
    readyCount: statuses.filter((s) => s.state === 'READY').length,
    activeCandidateId: active?.id ?? null,
    candidates: statuses,
  };
}

function classifyCooldownMs(errMsg: string): { cooldownMs: number; category: string } {
  const lower = errMsg.toLowerCase();
  if (/\b(401|403|404)\b|api_key_invalid|api key not valid|not found/.test(lower)) {
    return { cooldownMs: 30 * 60_000, category: 'AUTH_OR_UNAVAILABLE' };
  }
  if (/per[_\s-]*day|daily|rpd|limit:\s*0|exceeded\s+your\s+current\s+quota/.test(lower)) {
    return { cooldownMs: 15 * 60_000, category: 'DAILY_QUOTA' };
  }
  if (/\b429\b|resource_exhausted|rate[_\s-]*limit|too many requests/.test(lower)) {
    return { cooldownMs: 65_000, category: 'RATE_LIMITED' };
  }
  if (/timed\s*out|timeout|aborted/.test(lower)) {
    return { cooldownMs: 3 * 60_000, category: 'TIMEOUT' };
  }
  return { cooldownMs: 45_000, category: 'TRANSIENT_ERROR' };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_res, rej) => {
        timer = setTimeout(() => rej(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function defaultExecutor(
  candidate: LlmCandidate,
  req: LlmAuditRequest
): Promise<{ text: string; usedVision: boolean }> {
  if (candidate.provider === 'GEMINI') {
    const ai = new GoogleGenAI({
      apiKey: candidate.apiKey!,
      httpOptions: { timeout: MODEL_TIMEOUT_MS },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: req.userPrompt },
    ];
    let usedVision = false;
    if (req.attachment && candidate.supportsVision) {
      parts.push({
        inlineData: {
          mimeType: req.attachment.mimeType,
          data: req.attachment.base64Data,
        },
      });
      usedVision = true;
    }

    const res = await withTimeout(
      ai.models.generateContent({
        model: candidate.model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: req.systemInstruction,
          responseMimeType: 'application/json',
          temperature: req.temperature ?? 0.15,
        },
      }),
      MODEL_TIMEOUT_MS,
      candidate.id
    );

    const text = (res.text ?? '').trim();
    if (!text) throw new Error(`${candidate.id} returned empty JSON.`);
    return { text, usedVision };
  }

  // OpenAI-compatible text providers (Groq, OpenRouter :free, Ollama)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (candidate.apiKey) headers.Authorization = `Bearer ${candidate.apiKey}`;
  if (candidate.provider === 'OPENROUTER') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
    headers['X-Title'] = 'VantagePaths Audit Hub';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetch(`${candidate.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: candidate.model,
        temperature: req.temperature ?? 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.systemInstruction },
          { role: 'user', content: req.userPrompt },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${candidate.id} HTTP ${res.status}: ${raw.slice(0, 200)}`);
    const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = parsed.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error(`${candidate.id} returned empty response.`);
    return { text, usedVision: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateStructuredAuditWithFailover(
  req: LlmAuditRequest,
  options?: {
    candidates?: LlmCandidate[];
    executor?: LlmAuditExecutor;
    nowMs?: number;
  }
): Promise<LlmAuditResult> {
  const all = options?.candidates ?? buildFreeLlmCandidates();
  // If we have a binary PDF/image attachment and no extracted text, prioritize vision-capable models
  const hasBinary = Boolean(req.attachment);
  const candidates = hasBinary
    ? [...all.filter((c) => c.supportsVision), ...all.filter((c) => !c.supportsVision)]
    : all;

  if (candidates.length === 0) {
    throw new Error('No free-tier LLM providers configured.');
  }

  const nowMs = options?.nowMs ?? Date.now();
  const exec = options?.executor ?? defaultExecutor;

  const ready = candidates.filter((c) => {
    const cd = cooldownMap.get(c.id);
    return !cd || cd.cooldownUntilMs <= nowMs;
  });
  const attemptList = ready.length > 0 ? ready : [candidates[0]];

  let lastErr: unknown = null;
  for (const candidate of attemptList) {
    try {
      const res = await exec(candidate, req);
      cooldownMap.delete(candidate.id);
      return {
        text: res.text,
        provider: candidate.provider,
        model: candidate.model,
        usedVision: res.usedVision,
      };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const { cooldownMs, category } = classifyCooldownMs(msg);
      cooldownMap.set(candidate.id, {
        cooldownUntilMs: nowMs + cooldownMs,
        reason: `${category}: ${msg.slice(0, 140)}`,
      });
    }
  }

  throw new Error(
    lastErr instanceof Error ? lastErr.message : 'All configured free-tier LLM models failed.'
  );
}
