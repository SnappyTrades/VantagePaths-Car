import React from 'react';

export interface HeroQuickPill {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface PageHeroBannerProps {
  kicker: string;
  titleWhite: string;
  titleAccent: string;
  subtitle: string;
  pills?: HeroQuickPill[];
  imageSrc?: string;
  imageAlt?: string;
  imageBadgeTop?: string;
  imageBadgeValue?: string;
  accentTone?: 'emerald' | 'sapphire';
}

/**
 * Cohesive Executive Midnight-to-Ocean Hero Banner used across every inner tab
 * (/buy, /rescue, /insurance, /sell, /states, /admin) so the entire platform shares
 * the same high-contrast luxury automotive-fintech visual language.
 */
export const PageHeroBanner: React.FC<PageHeroBannerProps> = ({
  kicker,
  titleWhite,
  titleAccent,
  subtitle,
  pills = [],
  imageSrc,
  imageAlt = '',
  imageBadgeTop,
  imageBadgeValue,
  accentTone = 'emerald',
}) => {
  return (
    <section className="vp-hero-canvas relative overflow-hidden pb-16 pt-10 text-white sm:pb-20 sm:pt-12">
      {/* Subtle architectural contour paths */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        viewBox="0 0 1440 420"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-100 370 C 320 260, 740 420, 1540 160"
          stroke="url(#vpHeroLine1)"
          strokeWidth="2"
        />
        <path
          d="M-80 400 C 400 300, 820 440, 1540 210"
          stroke="url(#vpHeroLine2)"
          strokeWidth="1.25"
          strokeDasharray="6 6"
        />
        <defs>
          <linearGradient id="vpHeroLine1" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0" />
            <stop offset="50%" stopColor="#2DD4BF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="vpHeroLine2" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className={`grid grid-cols-1 items-center gap-8 ${imageSrc ? 'lg:grid-cols-12' : ''}`}>
          <div className={imageSrc ? 'lg:col-span-7 xl:col-span-8' : 'max-w-4xl'}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-300 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  accentTone === 'sapphire' ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8]' : 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                }`}
              />
              {kicker}
            </div>

            <h1 className="font-display mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
              {titleWhite}{' '}
              <span className="bg-gradient-to-r from-[#2DD4BF] via-[#34D399] to-[#38BDF8] bg-clip-text text-transparent">
                {titleAccent}
              </span>
            </h1>

            <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {subtitle}
            </p>

            {pills.length > 0 && (
              <div className="mt-6 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 backdrop-blur-md sm:rounded-full">
                {pills.map((p, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="hidden h-4 w-px bg-white/15 sm:inline-block" />}
                    <button
                      type="button"
                      onClick={p.onClick}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-100 transition ${
                        p.onClick ? 'hover:bg-white/12 hover:text-teal-200 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {p.icon && <span className="text-teal-300">{p.icon}</span>}
                      <span>{p.label}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {imageSrc && (
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="group relative overflow-hidden rounded-3xl border border-white/20 bg-white/5 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <div className="relative h-48 overflow-hidden rounded-2xl sm:h-52">
                  <img
                    src={imageSrc}
                    alt={imageAlt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#041225]/85 via-[#041225]/20 to-transparent" />
                  {(imageBadgeTop || imageBadgeValue) && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/15 bg-[#06182E]/85 px-3.5 py-2.5 backdrop-blur-md">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        {imageBadgeTop}
                      </span>
                      <span className="font-mono text-xs font-extrabold text-emerald-300">
                        {imageBadgeValue}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
