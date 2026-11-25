import React from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

export interface PartnerCardProps {
  partnerId: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  source?: string;
  accent?: 'teal' | 'navy' | 'amber';
}

/**
 * High-trust, FTC-disclosed outbound affiliate/partner card.
 * Routes through /api/partner/click/:partnerId so VantagePaths tracks every click
 * and earns referral revenue even when users stay 100% on free tools!
 */
export const PartnerCard: React.FC<PartnerCardProps> = ({
  partnerId,
  badge,
  title,
  subtitle,
  ctaLabel,
  source = 'pillar',
  accent = 'teal',
}) => {
  const styles =
    accent === 'navy'
      ? 'border-[#0B1528]/15 bg-[#0B1528] text-white'
      : accent === 'amber'
      ? 'border-amber-300/70 bg-amber-50/70 text-[#0B1528]'
      : 'border-teal-200 bg-teal-50/70 text-[#0B1528]';

  const btnStyles =
    accent === 'navy'
      ? 'bg-teal-400 text-[#042F2E] hover:bg-teal-300'
      : 'bg-[#0F766E] text-white hover:bg-[#115E59]';

  const subText = accent === 'navy' ? 'text-slate-300' : 'text-slate-600';
  const badgeStyles =
    accent === 'navy'
      ? 'bg-teal-400/15 text-teal-300 border-teal-400/30'
      : 'bg-white text-[#0F766E] border-teal-200';

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${styles}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${badgeStyles}`}
            >
              <ShieldCheck className="h-3 w-3" /> {badge}
            </span>
            <span className="text-[10.5px] font-medium opacity-70">Partner Recommendation</span>
          </div>
          <h3 className="text-base font-extrabold leading-snug">{title}</h3>
          <p className={`max-w-2xl text-xs leading-relaxed ${subText}`}>{subtitle}</p>
        </div>

        <a
          href={`/api/partner/click/${encodeURIComponent(partnerId)}?source=${encodeURIComponent(source)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-extrabold shadow-sm transition ${btnStyles}`}
        >
          {ctaLabel} <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <div className={`mt-3 border-t pt-2 text-[10.5px] ${accent === 'navy' ? 'border-white/10 text-slate-400' : 'border-slate-200/80 text-slate-500'}`}>
        FTC Disclosure: VantagePaths is 100% independent. We may earn a partner commission if you compare or fund through this link — at $0 extra cost to you.
      </div>
    </div>
  );
};
