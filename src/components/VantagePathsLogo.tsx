import React from 'react';

interface LogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

/**
 * Crisp scalable vector recreation of the VantagePaths brand mark:
 * - Deep Navy house roofline + chimney
 * - Slate-blue couch silhouette behind a modern front-facing car
 * - Sweeping Emerald S-curve path leading to a location pin
 * - Bold upright "Vantage" + Bold Italic Emerald "Paths" wordmark
 */
export const VantagePathsLogo: React.FC<LogoProps> = ({
  theme = 'light',
  size = 'md',
  showTagline = false,
}) => {
  const navy = theme === 'dark' ? '#F8FAFC' : '#082545';
  const carCutout = theme === 'dark' ? '#082545' : '#082545';
  const carBody = '#FFFFFF';
  const couchFill = theme === 'dark' ? '#64748B' : '#415E78';
  const emerald = '#05A66B';

  const iconSizes = {
    sm: 'h-9 w-11',
    md: 'h-11 w-14',
    lg: 'h-20 w-24',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[22px]',
    lg: 'text-3xl sm:text-4xl',
  };

  return (
    <div className={`inline-flex items-center ${size === 'lg' ? 'flex-col gap-2 text-center' : 'gap-2.5 text-left'}`}>
      {/* Vector Brand Mark: House + Couch + Car + Emerald Path + Pin */}
      <svg
        viewBox="0 0 120 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0`}
        aria-hidden="true"
      >
        {/* House Roof + Chimney */}
        <path
          d="M16 64V38C16 35.5 17.3 33.2 19.5 31.9L56.2 9.8C58.5 8.4 61.5 8.4 63.8 9.8L79 19V13.5C79 12.1 80.1 11 81.5 11H88.5C89.9 11 91 12.1 91 13.5V26.2L100.5 31.9C102.7 33.2 104 35.5 104 38V52"
          stroke={navy}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Couch Silhouette Behind Car */}
        <path
          d="M27 61V46C27 41.5 30.5 38 35 38H37V34C37 29.5 40.8 26 45.5 26H58C60 26 61.5 27 62 28C62.5 27 64 26 66 26H74.5C79.2 26 83 29.5 83 34V38H85C89.5 38 93 41.5 93 46V57H27Z"
          fill={couchFill}
        />

        {/* Modern Car Silhouette (Front View) */}
        <path
          d="M36 63V51C36 47.5 38 44.5 41 43L45.5 34.5C47 31.8 49.8 30 53 30H67C70.2 30 73 31.8 74.5 34.5L79 43C82 44.5 84 47.5 84 51V60L36 63Z"
          fill={carBody}
          stroke={carCutout}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* Side Mirrors */}
        <rect x="32.5" y="40.5" width="5" height="3.2" rx="1.5" fill={carBody} stroke={carCutout} strokeWidth="2" />
        <rect x="82.5" y="40.5" width="5" height="3.2" rx="1.5" fill={carBody} stroke={carCutout} strokeWidth="2" />
        {/* Windshield */}
        <path d="M44.5 42L48 34.5H72L75.5 42H44.5Z" fill={carCutout} />
        {/* Headlights */}
        <path d="M40 48.5C42.5 48 46.5 49 48 51H40.5C39.5 50 39.5 49 40 48.5Z" fill={carCutout} />
        <path d="M80 48.5C77.5 48 73.5 49 72 51H79.5C80.5 50 80.5 49 80 48.5Z" fill={carCutout} />
        {/* Lower Grille */}
        <path d="M44 59C46 55.2 51 54 60 54C69 54 74 55.2 76 59H44Z" fill={carCutout} />

        {/* Sweeping Emerald S-Curve Path */}
        <path
          d="M14 87C23 73 43 65 92 61.5L94.5 66C61 69.5 49 74.5 49 78.5C49 81.8 60 84.5 78 87.5C52 86.5 29 85.5 14 87Z"
          fill={emerald}
        />

        {/* Emerald Location Pin on Right */}
        <path
          d="M98 44C91.9 44 87 48.9 87 55C87 62.6 98 73 98 73C98 73 109 62.6 109 55C109 48.9 104.1 44 98 44Z"
          fill={emerald}
          stroke={theme === 'dark' ? '#082545' : '#FAF9F5'}
          strokeWidth="2.5"
        />
        <circle cx="98" cy="54.5" r="4.2" fill="#FFFFFF" />
      </svg>

      {/* Wordmark + Optional Tagline */}
      <div>
        <div className={`font-display font-extrabold leading-none tracking-tight ${textSizes[size]}`}>
          <span style={{ color: navy }}>Vantage</span>
          <span className="italic" style={{ color: emerald }}>
            Paths
          </span>
        </div>
        {showTagline ? (
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[11px] font-medium italic text-slate-600">
            <span className="h-[2px] w-6 rounded bg-[#05A66B]" />
            <span>Smarter, from your couch.</span>
            <span className="h-[2px] w-6 rounded bg-[#05A66B]" />
          </div>
        ) : (
          <div
            className={`mt-0.5 text-[10px] font-bold uppercase tracking-widest ${
              theme === 'dark' ? 'text-slate-400' : 'text-[#415E78]'
            }`}
          >
            Smarter, From Your Couch
          </div>
        )}
      </div>
    </div>
  );
};
