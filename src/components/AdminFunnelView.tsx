import React, { useEffect, useState } from 'react';
import { Activity, Cpu, DollarSign, RefreshCw, TrendingUp, Users } from 'lucide-react';
import type { AnalyticsSummaryResponse, LlmPoolStatusResponse } from '../shared/types';

export const AdminFunnelView: React.FC = () => {
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [llm, setLlm] = useState<LlmPoolStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        fetch('/api/analytics/summary'),
        fetch('/api/llm/status'),
      ]);
      setSummary(await sRes.json());
      setLlm(await lRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            VantagePaths Telemetry
          </span>
          <h1 className="text-2xl font-bold text-white">Live Revenue & Conversion Funnel</h1>
          <p className="text-sm text-slate-400">
            Compare conversion rates across Freight, Auto, and Home Bids to see which vertical prints revenue fastest.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard icon={<Activity className="h-4 w-4 text-sky-400" />} label="Total Audits Run" value={String(summary.totalAudits)} />
            <KpiCard icon={<DollarSign className="h-4 w-4 text-emerald-400" />} label="Unlocked Reports" value={`${summary.totalUnlocked} (${summary.conversionRatePct}%)`} />
            <KpiCard icon={<TrendingUp className="h-4 w-4 text-amber-400" />} label="Total Savings Flagged" value={`$${summary.totalEstimatedSavingsFlaggedUsd.toLocaleString()}`} />
            <KpiCard icon={<Users className="h-4 w-4 text-violet-400" />} label="Phase 2 Waitlist" value={String(summary.waitlistCount)} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="border-b border-slate-800 px-5 py-3.5 text-sm font-semibold text-white">
              Vertical Performance Comparison
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Vertical</th>
                    <th className="px-5 py-3">Audits</th>
                    <th className="px-5 py-3">Checkout Clicks</th>
                    <th className="px-5 py-3">Unlocks</th>
                    <th className="px-5 py-3">PDF Downloads</th>
                    <th className="px-5 py-3">Avg Savings Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {summary.byVertical.map((row) => (
                    <tr key={row.vertical} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold uppercase text-emerald-400">{row.vertical}</td>
                      <td className="px-5 py-3 font-mono">{row.audits}</td>
                      <td className="px-5 py-3 font-mono">{row.checkoutClicks}</td>
                      <td className="px-5 py-3 font-mono font-bold text-white">{row.unlocked}</td>
                      <td className="px-5 py-3 font-mono">{row.pdfDownloads}</td>
                      <td className="px-5 py-3 font-mono text-amber-300">${row.avgSavingsUsd.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {llm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Cpu className="h-4 w-4 text-emerald-400" /> $0 Free-Tier AI Failover Pool ({llm.readyCount}/{llm.configuredCount} Ready)
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-400">
              Active: {llm.activeCandidateId || 'Deterministic Fallback'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {llm.candidates.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-white">{c.model}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.state === 'READY'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {c.state}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {c.provider} • {c.supportsVision ? 'PDF + Photo Vision' : 'Text Only'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && summary.recentEvents.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Recent Funnel Events</h2>
          <div className="space-y-1.5 font-mono text-xs">
            {summary.recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-slate-300"
              >
                <span>
                  <span className="text-emerald-400">{ev.event_name}</span> •{' '}
                  <span className="uppercase text-sky-400">{ev.vertical}</span>
                  {ev.audit_id ? ` • ${ev.audit_id}` : ''}
                </span>
                <span className="text-slate-500">{new Date(ev.created_utc).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
    <div className="flex items-center justify-between text-xs text-slate-400">
      <span>{label}</span>
      {icon}
    </div>
    <div className="mt-2 font-mono text-2xl font-bold text-white">{value}</div>
  </div>
);
