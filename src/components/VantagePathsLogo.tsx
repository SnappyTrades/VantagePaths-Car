import React from 'react';

interface LogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

/**
 * Official Universal VantagePaths Crest & Wordmark (matches uploaded brand mark):
 * - Deep Navy pitched roofline with eaves, right chimney & framing side walls
 * - Soft sky-cyan circular portal glow inside the home
 * - Rolled-arm sofa silhouette with feet resting on the horizon
 * - Shield-shaped emerald-teal lawn split by a sweeping white S-curve path leading to the sofa
 * - Bold upright "Vantage" + Bold upright Emerald "Paths" wordmark
 * - "— Smarter from your couch. —" tagline flanked by cyan accent bars
 */
export const VantagePathsLogo: React.FC<LogoProps> = ({
  theme = 'light',
  size = 'md',
  showTagline = false,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const wordmarkNavy = theme === 'dark' ? '#FFFFFF' : '#062542';
  const wordmarkEmerald = theme === 'dark' ? '#2DD4BF' : '#067A60';
  const roofStroke = theme === 'dark' ? '#E2E8F0' : '#062542';
  const sofaFill = '#082F4E';

  const iconSizes = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
    lg: 'h-24 w-24 sm:h-28 sm:w-28',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[22px]',
    lg: 'text-3xl sm:text-[2.5rem]',
  };

  return (
    <div
      className={`inline-flex items-center ${
        size === 'lg' ? 'flex-col gap-2.5 text-center' : 'gap-2.5 text-left'
      }`}
    >
      <svg
        viewBox="0 0 120 112"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`sky_${uid}`} x1="60" y1="28" x2="60" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#89DDFB" />
            <stop offset="68%" stopColor="#E0F6FE" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id={`hillL_${uid}`} x1="20" y1="62" x2="62" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#088C78" />
            <stop offset="100%" stopColor="#046C5B" />
          </linearGradient>
          <linearGradient id={`hillR_${uid}`} x1="62" y1="62" x2="100" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#057A67" />
          </linearGradient>
        </defs>

        {/* White Interior Backing (keeps sky & S-path crisp on dark navbars too!) */}
        <path
          d="M21 42 L60 16 L99 42 V73 C99 84 82 96 63 104 C61 105 59 105 57 104 C38 96 21 84 21 73 Z"
          fill="#FFFFFF"
        />

        {/* Soft Sky-Cyan Circular Arch Glow Behind Sofa */}
        <circle cx="60" cy="57" r="26" fill={`url(#sky_${uid})`} />

        {/* Chimney on Right Slope */}
        <rect x="74" y="14" width="11" height="19" rx="2.5" fill={roofStroke} />

        {/* Pitched Roof with Rounded Eaves */}
        <path
          d="M14 44 L56.5 14.5 C58.6 13 61.4 13 63.5 14.5 L106 44"
          stroke={roofStroke}
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Framing Left & Right House Walls */}
        <path d="M21 41 V67.5" stroke={roofStroke} strokeWidth="8.5" strokeLinecap="round" />
        <path d="M99 41 V67.5" stroke={roofStroke} strokeWidth="8.5" strokeLinecap="round" />

        {/* Rolled-Arm Sofa Silhouette with Feet */}
        <g fill={sofaFill}>
          {/* Backrest */}
          <rect x="44" y="47" width="32" height="12" rx="4.5" />
          {/* Rolled Left & Right Arms */}
          <circle cx="42.5" cy="54.5" r="4.2" />
          <circle cx="77.5" cy="54.5" r="4.2" />
          {/* Seat Base */}
          <rect x="41.5" y="54.5" width="37" height="7" rx="3" />
          {/* White Cushion Seam Highlight */}
          <rect x="46.5" y="54.2" width="27" height="1.5" rx="0.75" fill="#E0F6FE" />
          {/* Sofa Feet */}
          <rect x="44.5" y="60.5" width="3.5" height="3.5" rx="1" />
          <rect x="72" y="60.5" width="3.5" height="3.5" rx="1" />
        </g>

        {/* Left Emerald Shield-Hill (leaves sweeping white S-path open in center!) */}
        <path
          d="M17 69.5 C31 64 47 62.5 59 63.5 C67 64.5 67 69 57 73.5 C44 79 34 85 28 92.5 C20 86.5 17 79.5 17 73 Z"
          fill={`url(#hillL_${uid})`}
        />

        {/* Right Emerald Shield-Hill Tapering to Bottom Crest Point */}
        <path
          d="M63.5 63.5 C78 63.5 92 65.5 103 69.5 V73 C103 83.5 85 95.5 63.5 104.5 C56.5 107 52 102.5 53 97.5 C54.5 90.5 64 85.5 73 80 C80 75.5 78 69.5 63.5 63.5 Z"
          fill={`url(#hillR_${uid})`}
        />
      </svg>

      {/* Bold Upright Wordmark + Tagline */}
      <div>
        <div className={`font-display font-extrabold leading-none tracking-tight ${textSizes[size]}`}>
          <span style={{ color: wordmarkNavy }}>Vantage</span>
          <span style={{ color: wordmarkEmerald }}>Paths</span>
        </div>
        {showTagline ? (
          <div
            className={`mt-2 flex items-center justify-center gap-2.5 text-xs font-medium sm:text-sm ${
              theme === 'dark' ? 'text-slate-200' : 'text-[#082F4E]'
            }`}
          >
            <span className="h-[2px] w-8 rounded-full bg-[#2DD4BF]" />
            <span>Smarter from your couch.</span>
            <span className="h-[2px] w-8 rounded-full bg-[#2DD4BF]" />
          </div>
        ) : (
          <div
            className={`mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide ${
              theme === 'dark' ? 'text-slate-300' : 'text-[#082F4E]/80'
            }`}
          >
            <span className="h-[1.5px] w-3.5 rounded-full bg-[#2DD4BF]" />
            <span>Smarter from your couch.</span>
          </div>
        )}
      </div>
    </div>
  );
};
