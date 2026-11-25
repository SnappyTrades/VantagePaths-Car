import Database from 'better-sqlite3';
import path from 'node:path';
import type {
  AnalyticsSummaryResponse,
  AuditVerticalId,
  StoredAuditRecord,
} from '../src/shared/types.ts';

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'vantagepaths_audits.db');

export class AuditDatabase {
  public readonly db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audits (
        audit_id TEXT PRIMARY KEY,
        vertical TEXT NOT NULL,
        created_utc TEXT NOT NULL,
        file_name TEXT NOT NULL,
        estimated_savings_usd REAL NOT NULL DEFAULT 0,
        is_unlocked INTEGER NOT NULL DEFAULT 0,
        unlocked_utc TEXT,
        unlock_method TEXT,
        stripe_session_id TEXT,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audits_vertical ON audits(vertical);
      CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_utc);
      CREATE INDEX IF NOT EXISTS idx_audits_stripe ON audits(stripe_session_id);

      CREATE TABLE IF NOT EXISTS funnel_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_utc TEXT NOT NULL,
        event_name TEXT NOT NULL,
        vertical TEXT NOT NULL,
        audit_id TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_vertical ON funnel_events(vertical);
      CREATE INDEX IF NOT EXISTS idx_events_name ON funnel_events(event_name);

      CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_utc TEXT NOT NULL,
        email TEXT NOT NULL,
        vertical TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_vertical ON waitlist(email, vertical);

      CREATE TABLE IF NOT EXISTS inventory_cache (
        cache_key TEXT PRIMARY KEY,
        created_utc TEXT NOT NULL,
        expires_utc TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }

  public saveAudit(record: StoredAuditRecord): void {
    this.db
      .prepare(
        `INSERT INTO audits (
          audit_id, vertical, created_utc, file_name, estimated_savings_usd,
          is_unlocked, unlocked_utc, unlock_method, stripe_session_id, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.auditId,
        record.vertical,
        record.createdUtc,
        record.fileName,
        record.estimatedSavingsUsd,
        record.isUnlocked ? 1 : 0,
        record.unlockedUtc,
        record.unlockMethod,
        record.stripeSessionId,
        JSON.stringify(record)
      );
  }

  public getAudit(auditId: string): StoredAuditRecord | null {
    const row = this.db
      .prepare(
        `SELECT payload_json, is_unlocked, unlocked_utc, unlock_method, stripe_session_id
         FROM audits WHERE audit_id = ?`
      )
      .get(auditId) as
      | {
          payload_json: string;
          is_unlocked: number;
          unlocked_utc: string | null;
          unlock_method: StoredAuditRecord['unlockMethod'];
          stripe_session_id: string | null;
        }
      | undefined;

    if (!row) return null;
    const parsed = JSON.parse(row.payload_json) as StoredAuditRecord;
    return {
      ...parsed,
      isUnlocked: row.is_unlocked === 1,
      unlockedUtc: row.unlocked_utc,
      unlockMethod: row.unlock_method,
      stripeSessionId: row.stripe_session_id,
    };
  }

  public markAuditUnlocked(params: {
    auditId: string;
    method: 'STRIPE_CHECKOUT' | 'DEMO_UNLOCK';
    stripeSessionId?: string | null;
  }): StoredAuditRecord | null {
    const existing = this.getAudit(params.auditId);
    if (!existing) return null;
    const nowUtc = new Date().toISOString();
    const updated: StoredAuditRecord = {
      ...existing,
      isUnlocked: true,
      unlockedUtc: existing.unlockedUtc ?? nowUtc,
      unlockMethod: existing.unlockMethod ?? params.method,
      stripeSessionId: params.stripeSessionId ?? existing.stripeSessionId,
    };

    this.db
      .prepare(
        `UPDATE audits
         SET is_unlocked = 1,
             unlocked_utc = ?,
             unlock_method = ?,
             stripe_session_id = ?,
             payload_json = ?
         WHERE audit_id = ?`
      )
      .run(
        updated.unlockedUtc,
        updated.unlockMethod,
        updated.stripeSessionId,
        JSON.stringify(updated),
        params.auditId
      );

    return updated;
  }

  public logEvent(params: {
    eventName: string;
    vertical: string;
    auditId?: string | null;
    metadata?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO funnel_events (created_utc, event_name, vertical, audit_id, metadata_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        new Date().toISOString(),
        params.eventName,
        params.vertical,
        params.auditId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null
      );
  }

  public addWaitlistEntry(email: string, vertical: string, notes = ''): { alreadyExists: boolean } {
    const cleanEmail = email.trim().toLowerCase();
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO waitlist (created_utc, email, vertical, notes)
         VALUES (?, ?, ?, ?)`
      )
      .run(new Date().toISOString(), cleanEmail, vertical, notes.trim().slice(0, 300));
    return { alreadyExists: res.changes === 0 };
  }

  public getInventoryCache(cacheKey: string): { payload: unknown; expiresUtc: string } | null {
    const row = this.db
      .prepare(`SELECT expires_utc, payload_json FROM inventory_cache WHERE cache_key = ?`)
      .get(cacheKey) as { expires_utc: string; payload_json: string } | undefined;
    if (!row) return null;
    if (Date.parse(row.expires_utc) <= Date.now()) {
      this.db.prepare(`DELETE FROM inventory_cache WHERE cache_key = ?`).run(cacheKey);
      return null;
    }
    return { payload: JSON.parse(row.payload_json), expiresUtc: row.expires_utc };
  }

  public setInventoryCache(cacheKey: string, payload: unknown, ttlSeconds = 21600): string {
    const now = Date.now();
    const expiresUtc = new Date(now + ttlSeconds * 1000).toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO inventory_cache (cache_key, created_utc, expires_utc, payload_json)
         VALUES (?, ?, ?, ?)`
      )
      .run(cacheKey, new Date(now).toISOString(), expiresUtc, JSON.stringify(payload));
    return expiresUtc;
  }

  public getAnalyticsSummary(): AnalyticsSummaryResponse {
    const totals = this.db
      .prepare(
        `SELECT COUNT(*) AS totalAudits,
                SUM(CASE WHEN is_unlocked = 1 THEN 1 ELSE 0 END) AS totalUnlocked,
                COALESCE(SUM(estimated_savings_usd), 0) AS totalSavings
         FROM audits`
      )
      .get() as { totalAudits: number; totalUnlocked: number | null; totalSavings: number };

    const waitlistRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM waitlist`)
      .get() as { cnt: number };

    const verticals: AuditVerticalId[] = ['freight', 'auto', 'home-bids'];
    const byVertical = verticals.map((v) => {
      const a = this.db
        .prepare(
          `SELECT COUNT(*) AS audits,
                  SUM(CASE WHEN is_unlocked = 1 THEN 1 ELSE 0 END) AS unlocked,
                  COALESCE(AVG(estimated_savings_usd), 0) AS avgSavings
           FROM audits WHERE vertical = ?`
        )
        .get(v) as { audits: number; unlocked: number | null; avgSavings: number };

      const checkoutClicks = (
        this.db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM funnel_events WHERE vertical = ? AND event_name = 'checkout_clicked'`
          )
          .get(v) as { cnt: number }
      ).cnt;

      const pdfDownloads = (
        this.db
          .prepare(
            `SELECT COUNT(*) AS cnt FROM funnel_events WHERE vertical = ? AND event_name = 'pdf_downloaded'`
          )
          .get(v) as { cnt: number }
      ).cnt;

      return {
        vertical: v,
        audits: a.audits,
        unlocked: a.unlocked ?? 0,
        checkoutClicks,
        pdfDownloads,
        avgSavingsUsd: Math.round(a.avgSavings),
      };
    });

    const partnerRows = this.db
      .prepare(
        `SELECT metadata_json FROM funnel_events WHERE event_name = 'partner_click'`
      )
      .all() as Array<{ metadata_json: string | null }>;

    const partnerMap = new Map<string, { clicks: number; projectedRevenueUsd: number }>();
    let partnerClicksTotal = 0;
    let projectedAffiliateRevenueUsd = 0;
    for (const row of partnerRows) {
      try {
        const meta = row.metadata_json ? JSON.parse(row.metadata_json) : {};
        const pid = String(meta.partnerId || 'unknown');
        const epc = Number(meta.estimatedEpcUsd) || 3.0;
        partnerClicksTotal += 1;
        projectedAffiliateRevenueUsd += epc;
        const prev = partnerMap.get(pid) || { clicks: 0, projectedRevenueUsd: 0 };
        prev.clicks += 1;
        prev.projectedRevenueUsd = Math.round((prev.projectedRevenueUsd + epc) * 100) / 100;
        partnerMap.set(pid, prev);
      } catch {
        // ignore malformed metadata
      }
    }

    const byPartner = [...partnerMap.entries()]
      .map(([partnerId, stats]) => ({ partnerId, ...stats }))
      .sort((a, b) => b.clicks - a.clicks);

    const recentEvents = this.db
      .prepare(
        `SELECT id, created_utc, event_name, vertical, audit_id
         FROM funnel_events ORDER BY id DESC LIMIT 20`
      )
      .all() as AnalyticsSummaryResponse['recentEvents'];

    const totalAudits = totals.totalAudits ?? 0;
    const totalUnlocked = totals.totalUnlocked ?? 0;

    return {
      generatedUtc: new Date().toISOString(),
      totalAudits,
      totalUnlocked,
      conversionRatePct: totalAudits > 0 ? Number(((totalUnlocked / totalAudits) * 100).toFixed(1)) : 0,
      totalEstimatedSavingsFlaggedUsd: Math.round(totals.totalSavings ?? 0),
      waitlistCount: waitlistRow.cnt ?? 0,
      partnerClicksTotal,
      projectedAffiliateRevenueUsd: Math.round(projectedAffiliateRevenueUsd * 100) / 100,
      projectedDirectRevenueUsd: totalUnlocked * 29,
      byPartner,
      byVertical,
      recentEvents,
    };
  }
}
