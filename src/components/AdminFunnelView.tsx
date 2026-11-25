import React, { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bell, Cpu, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import type { AnalyticsSummaryResponse, LlmPoolStatusResponse } from '../shared/types';
import { PageHeroBanner } from './PageHeroBanner';

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

  const combinedProjectedRev = summary
    ? Math.round((summary.projectedDirectRevenueUsd + summary.projectedAffiliateRevenueUsd) * 100) / 100
    : 0;

  return (
    <>
      <PageHeroBanner
        kicker="VantagePaths Telemetry • Revenue Dashboard"
        titleWhite="Direct Pass Sales &"
        titleAccent="Partner Affiliate Revenue"
        subtitle="Real-time telemetry tracking both visitors who unlock the $29 Pass and free visitors who click high-CPA partner links."
        pills={[
          { label: 'Pass Sales' },
          { label: 'Tracked Outbound EPC' },
          { label: '$0 AI Pool Status' },
        ]}
      />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-[#071930]">
              Telemetry &amp; Conversion Performance
            </h2>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-[#071930] hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Live Data
          </button>
        </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <KpiCard icon={<DollarSign className="h-4 w-4 text-[#0F766E]" />} label="Est. Combined Revenue" value={`$${combinedProjectedRev.toLocaleString()}`} highlight />
            <KpiCard icon={<Activity className="h-4 w-4 text-sky-600" />} label="Direct Pass Unlocks" value={`${summary.totalUnlocked} ($${summary.projectedDirectRevenueUsd})`} />
            <KpiCard icon={<ArrowUpRight className="h-4 w-4 text-amber-600" />} label="Affiliate Partner Clicks" value={`${summary.partnerClicksTotal} (~$${summary.projectedAffiliateRevenueUsd})`} />
            <KpiCard icon={<Bell className="h-4 w-4 text-violet-600" />} label="Renewal / Alert Subs" value={String(summary.waitlistCount)} />
            <KpiCard icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} label="Savings Flagged" value={`$${summary.totalEstimatedSavingsFlaggedUsd.toLocaleString()}`} />
          </div>

          {/* Affiliate Partner Click Breakdown */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 bg-[#FAF9F5] px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Revenue Layer 2: Outbound Partner / Affiliate Click Attribution (Earns Even Without $29 Purchase)
            </div>
            {summary.byPartner.length === 0 ? (
              <div className="p-5 text-xs text-slate-500">
                No outbound partner clicks recorded yet — click any Pre-Approval, Auto Refi, Insurance, or Cash-Offer button across the 4 pillars to watch live attribution appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Partner Placement ID</th>
                      <th className="px-5 py-3">Tracked Outbound Clicks</th>
                      <th className="px-5 py-3">Projected EPC Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.byPartner.map((p) => (
                      <tr key={p.partnerId}>
                        <td className="px-5 py-3 font-mono font-bold text-[#0F766E]">{p.partnerId}</td>
                        <td className="px-5 py-3 font-mono font-bold text-[#0B1528]">{p.clicks}</td>
                        <td className="px-5 py-3 font-mono font-bold text-emerald-700">${p.projectedRevenueUsd.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {llm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#0B1528]">
              <Cpu className="h-4 w-4 text-[#0F766E]" /> $0 Free-Tier Multimodal AI Failover Pool ({llm.readyCount}/{llm.configuredCount} Ready)
            </h2>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 font-mono text-xs font-bold text-[#0F766E]">
              Active: {llm.activeCandidateId || 'Deterministic Engine'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {llm.candidates.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#0B1528]">{c.model}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.state === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {c.state}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {c.provider} • {c.supportsVision ? 'PDF + Photo Vision' : 'Text Only'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && summary.recentEvents.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="mb-3 text-sm font-extrabold text-[#0B1528]">Recent Live Events</h2>
          <div className="space-y-1.5 font-mono text-xs">
            {summary.recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF9F5] px-3 py-2 text-slate-700"
              >
                <span>
                  <span className="font-bold text-[#0F766E]">{ev.event_name}</span> •{' '}
                  <span className="uppercase text-slate-500">{ev.vertical}</span>
                  {ev.audit_id ? ` • ${ev.audit_id}` : ''}
                </span>
                <span className="text-slate-400">{new Date(ev.created_utc).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; highlight?: boolean }> = ({
  icon,
  label,
  value,
  highlight = false,
}) => (
  <div
    className={`rounded-2xl border p-4 shadow-xs ${
      highlight ? 'border-[#0F766E] bg-[#0B1528] text-white' : 'border-slate-200 bg-white text-[#0B1528]'
    }`}
  >
    <div className={`flex items-center justify-between text-[11px] font-bold uppercase ${highlight ? 'text-teal-300' : 'text-slate-500'}`}>
      <span>{label}</span>
      {icon}
    </div>
    <div className="mt-2 font-mono text-xl font-extrabold">{value}</div>
  </div>
);
