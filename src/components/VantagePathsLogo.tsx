import React from 'react';

interface LogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

/**
 * Universal VantagePaths Brand Mark:
 * - Architectural house silhouette with chimney (Life & Home)
 * - Cozy modern sofa silhouette seated in an illuminated circular portal (Comfort / "From your couch")
 * - Sweeping emerald path carving forward through a sculpted foundation (Clear path forward / "VantagePaths")
 * - Clean "Vantage" in Navy/White + "Paths" in vibrant Emerald Italic
 * Universal for all 6 paths (Auto, Home, Money, Tech, Protect, Everyday Life).
 */
export const VantagePathsLogo: React.FC<LogoProps> = ({
  theme = 'light',
  size = 'md',
  showTagline = false,
}) => {
  const navy = theme === 'dark' ? '#F8FAFC' : '#082545';
  const houseColor = theme === 'dark' ? '#38BDF8' : '#082545';
  const sofaColor = theme === 'dark' ? '#E2E8F0' : '#082545';
  const emerald = '#05A66B';
  const emeraldLight = '#2DD4BF';

  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-20 w-20',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[22px]',
    lg: 'text-3xl sm:text-4xl',
  };

  return (
    <div
      className={`inline-flex items-center ${
        size === 'lg' ? 'flex-col gap-3 text-center' : 'gap-2.5 text-left'
      }`}
    >
      {/* Universal Vector Mark: House + Couch in Portal + Winding Emerald Path */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="vpPortalGlow" x1="50" y1="28" x2="50" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#E0F2FE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="vpHillGrad" x1="16" y1="52" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>

        {/* Portal Aura Circle */}
        <circle cx="50" cy="50" r="26" fill="url(#vpPortalGlow)" />

        {/* House Outline (Roof, Chimney, Left/Right Walls) */}
        <path
          d="M17 56V42C17 39.5 18.5 37.2 20.8 35.8L47.2 19.8C48.9 18.7 51.1 18.7 52.8 19.8L66.5 28.2V22.5C66.5 21.1 67.6 20 69 20H75C76.4 20 77.5 21.1 77.5 22.5V34.9L79.2 35.8C81.5 37.2 83 39.5 83 42V56"
          stroke={houseColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Universal Sofa Silhouette (Sitting comfortably in the illuminated portal) */}
        {/* Backrest Cushion */}
        <rect x="36" y="44" width="28" height="11" rx="4" fill={sofaColor} />
        {/* Left Armrest */}
        <rect x="32.5" y="46.5" width="5.5" height="10.5" rx="2.5" fill={sofaColor} />
        {/* Right Armrest */}
        <rect x="62" y="46.5" width="5.5" height="10.5" rx="2.5" fill={sofaColor} />
        {/* Seat Cushion Base */}
        <rect x="34" y="52" width="32" height="6" rx="2.5" fill={sofaColor} />

        {/* Sculpted Foundation Hill (Emerald) */}
        <path
          d="M18 56C25 54 36 53 50 53C64 53 75 54 82 56L82 66C82 72 77 78 70 82L30 82C23 78 18 72 18 66Z"
          fill="url(#vpHillGrad)"
        />

        {/* Sweeping S-Curve Path carved through the hill to the couch */}
        <path
          d="M50 53.5C51 59 42 66 34 72C28 76.5 35 81.5 44 82C58 82.5 68 76 68 70C68 64 58 60 52 54.5L50 53.5Z"
          fill="#FFFFFF"
        />
      </svg>

      {/* Wordmark + Optional Tagline */}
      <div>
        <div className={`font-display font-extrabold leading-none tracking-tight ${textSizes[size]}`}>
          <span style={{ color: navy }}>Vantage</span>
          <span className="italic" style={{ color: emeraldLight || emerald }}>
            Paths
          </span>
        </div>
        {showTagline ? (
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="h-[1.5px] w-5 rounded bg-teal-400" />
            <span>Smarter from your couch.</span>
            <span className="h-[1.5px] w-5 rounded bg-teal-400" />
          </div>
        ) : (
          <div
            className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Smarter From Your Couch
          </div>
        )}
      </div>
    </div>
  );
};
