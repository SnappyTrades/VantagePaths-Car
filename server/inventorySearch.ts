import { STATE_AUTO_RULES } from './autoKnowledge.ts';
import type { AuditDatabase } from './db.ts';

export interface InventorySearchQuery {
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  zip: string;
  radiusMiles: number;
  homeStateCode: string;
}

export interface MultiSiteDeepLink {
  site: string;
  badge: string;
  description: string;
  url: string;
}

export interface LeverageListingCard {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  exteriorColor: string;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  distanceMiles: number | null;
  advertisedPriceUsd: number;
  estimatedDocFeeUsd: number;
  estimatedTaxAndDmvUsd: number;
  estimatedTrueOtdUsd: number;
  daysOnMarket: number;
  priceDropCount: number;
  priceDropTotalUsd: number;
  leverageScore: number; // 0-100
  leverageLabel: 'HIGH LEVERAGE' | 'MODERATE LEVERAGE' | 'FIRM PRICING';
  leverageReason: string;
  listingUrl: string | null;
  isLiveApi: boolean;
}

export interface InventorySearchResponse {
  mode: 'LIVE_MARKETCHECK' | 'LIVE_AUTODEV' | 'PREVIEW_PLUS_DEEP_LINKS';
  cached: boolean;
  cacheExpiresUtc: string | null;
  querySummary: string;
  deepLinks: MultiSiteDeepLink[];
  listings: LeverageListingCard[];
  apiSetupHint: string | null;
}

/**
 * Computes a deterministic 0–100 "Buyer Negotiation Leverage Score"
 * based on Days on Lot, Price Drops, and Dealer State Doc Fee discipline.
 */
export function computeBuyerLeverageScore(params: {
  daysOnMarket: number;
  priceDropCount: number;
  priceDropTotalUsd: number;
  dealerDocFeeUsd: number;
}): {
  score: number;
  label: LeverageListingCard['leverageLabel'];
  reason: string;
} {
  let score = 38;
  const reasons: string[] = [];

  if (params.daysOnMarket >= 75) {
    score += 34;
    reasons.push(`${params.daysOnMarket} days sitting on lot (heavy floorplan interest pressure)`);
  } else if (params.daysOnMarket >= 45) {
    score += 22;
    reasons.push(`${params.daysOnMarket} days on lot (above average — motivated to move)`);
  } else if (params.daysOnMarket >= 25) {
    score += 10;
    reasons.push(`${params.daysOnMarket} days on lot`);
  } else {
    reasons.push(`Fresh inventory (${params.daysOnMarket} days)`);
  }

  if (params.priceDropCount >= 2 || params.priceDropTotalUsd >= 1500) {
    score += 20;
    reasons.push(
      `${params.priceDropCount} price drop(s) (-$${params.priceDropTotalUsd.toLocaleString()}) show softening demand`
    );
  } else if (params.priceDropCount === 1) {
    score += 10;
    reasons.push(`1 recent price cut (-$${params.priceDropTotalUsd.toLocaleString()})`);
  }

  if (params.dealerDocFeeUsd <= 250) {
    score += 8;
    reasons.push(`Low $${params.dealerDocFeeUsd} state-capped doc fee`);
  } else if (params.dealerDocFeeUsd >= 700) {
    score -= 8;
    reasons.push(`Watch out: high ~$${params.dealerDocFeeUsd} uncapped state doc fee`);
  }

  const clamped = Math.max(15, Math.min(98, score));
  const label: LeverageListingCard['leverageLabel'] =
    clamped >= 72 ? 'HIGH LEVERAGE' : clamped >= 50 ? 'MODERATE LEVERAGE' : 'FIRM PRICING';

  return {
    score: clamped,
    label,
    reason: reasons.join(' • '),
  };
}

/**
 * Generates 1-click pre-filtered search URLs across major marketplaces —
 * including Cars.com pre-sorted by Oldest Listed (highest buyer leverage!).
 */
export function buildMultiSiteDeepLinks(q: InventorySearchQuery): MultiSiteDeepLink[] {
  const year = encodeURIComponent(q.year.trim());
  const makeSlug = q.make.trim().toLowerCase().replace(/\s+/g, '_');
  const makeDash = q.make.trim().toLowerCase().replace(/\s+/g, '-');
  const modelSlug = q.model.trim().toLowerCase().replace(/\s+/g, '_');
  const modelDash = q.model.trim().toLowerCase().replace(/\s+/g, '-');
  const zip = encodeURIComponent(q.zip.trim() || '75201');
  const radius = Math.max(10, Math.min(500, Number(q.radiusMiles) || 100));
  const keyword = encodeURIComponent([q.trim, q.color].filter(Boolean).join(' ').trim());

  const colorMap: Record<string, string> = {
    black: 'black',
    white: 'white',
    silver: 'silver',
    gray: 'gray',
    grey: 'gray',
    blue: 'blue',
    red: 'red',
    green: 'green',
  };
  const carsColor = colorMap[q.color.trim().toLowerCase()] || '';

  const carsUrl = `https://www.cars.com/shopping/results/?makes[]=${encodeURIComponent(
    makeSlug
  )}&models[]=${encodeURIComponent(
    `${makeSlug}-${modelSlug}`
  )}&year_min=${year}&year_max=${year}&zip=${zip}&maximum_distance=${radius}${
    carsColor ? `&exterior_color_slugs[]=${carsColor}` : ''
  }${keyword ? `&keyword=${keyword}` : ''}&sort=listed_at`;

  const autoTraderUrl = `https://www.autotrader.com/cars-for-sale/all-cars/${year}/${encodeURIComponent(
    makeDash
  )}/${encodeURIComponent(modelDash)}?zip=${zip}&searchRadius=${radius}&sortBy=derivedpriceASC${
    keyword ? `&keywordPhrases=${keyword}` : ''
  }`;

  const carGurusUrl = `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=${zip}&distance=${radius}&startYear=${year}&endYear=${year}&sortDir=DESC&sortType=DAYS_ON_MARKET&searchChanged=true`;

  const trueCarUrl = `https://www.truecar.com/shop/new/?postalCode=${zip}&searchRadius=${radius}&year=${year}&make=${encodeURIComponent(
    makeDash
  )}&model=${encodeURIComponent(modelDash)}`;

  return [
    {
      site: 'Cars.com',
      badge: 'Pre-Sorted: Oldest Listed',
      description: 'Surfaces longest-sitting lot inventory first (highest dealer discount leverage).',
      url: carsUrl,
    },
    {
      site: 'CarGurus',
      badge: 'Sorted: Days on Market',
      description: 'Highlights stale listings & price-drop history around your ZIP.',
      url: carGurusUrl,
    },
    {
      site: 'AutoTrader',
      badge: 'Sorted: Lowest Price',
      description: 'Exact Year/Make/Model/Trim & color keywords pre-filtered.',
      url: autoTraderUrl,
    },
    {
      site: 'TrueCar',
      badge: 'Regional Market Check',
      description: 'Cross-check regional dealer volume pricing (remember: use burner email!).',
      url: trueCarUrl,
    },
  ];
}

function enrichOtdAndLeverage(
  raw: {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    exteriorColor: string;
    dealerName: string;
    dealerCity: string;
    dealerState: string;
    distanceMiles: number | null;
    advertisedPriceUsd: number;
    daysOnMarket: number;
    priceDropCount: number;
    priceDropTotalUsd: number;
    listingUrl: string | null;
    isLiveApi: boolean;
  },
  homeStateCode: string
): LeverageListingCard {
  const homeRule = STATE_AUTO_RULES[homeStateCode.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const dealerRule = STATE_AUTO_RULES[raw.dealerState.toUpperCase()] ?? homeRule;

  const estimatedDocFeeUsd = dealerRule.docFeeCapUsd ?? dealerRule.typicalDocFeeUsd;
  const estimatedTaxAndDmvUsd = Math.round(
    (raw.advertisedPriceUsd + estimatedDocFeeUsd) * (homeRule.typicalSalesTaxPct / 100) + 325
  );
  const estimatedTrueOtdUsd = raw.advertisedPriceUsd + estimatedDocFeeUsd + estimatedTaxAndDmvUsd;

  const lev = computeBuyerLeverageScore({
    daysOnMarket: raw.daysOnMarket,
    priceDropCount: raw.priceDropCount,
    priceDropTotalUsd: raw.priceDropTotalUsd,
    dealerDocFeeUsd: estimatedDocFeeUsd,
  });

  return {
    ...raw,
    estimatedDocFeeUsd,
    estimatedTaxAndDmvUsd,
    estimatedTrueOtdUsd,
    leverageScore: lev.score,
    leverageLabel: lev.label,
    leverageReason: lev.reason,
  };
}

function buildPreviewListings(q: InventorySearchQuery): LeverageListingCard[] {
  const yearNum = parseInt(q.year, 10) || 2026;
  const make = q.make.trim() || 'Toyota';
  const model = q.model.trim() || 'RAV4';
  const trim = q.trim.trim() || 'XLE Premium';
  const color = q.color.trim() || 'Black';
  const home = STATE_AUTO_RULES[q.homeStateCode.toUpperCase()] ?? STATE_AUTO_RULES.TX;
  const cityLabel = q.zip.startsWith('75') ? 'Dallas Metro' : `${home.name} Area`;

  const samples = [
    {
      id: 'preview-1',
      vin: '2T3P1RFV0RW441234',
      year: yearNum,
      make,
      model,
      trim,
      exteriorColor: color,
      dealerName: `${cityLabel} Volume Motors (Sample)`,
      dealerCity: q.zip.startsWith('75') ? 'Plano' : cityLabel,
      dealerState: home.code,
      distanceMiles: 19,
      advertisedPriceUsd: 37480,
      daysOnMarket: 82,
      priceDropCount: 3,
      priceDropTotalUsd: 2150,
      listingUrl: null,
      isLiveApi: false,
    },
    {
      id: 'preview-2',
      vin: '2T3P1RFV9RW518902',
      year: yearNum,
      make,
      model,
      trim,
      exteriorColor: color,
      dealerName: `North ${home.code} Auto Group (Sample)`,
      dealerCity: q.zip.startsWith('75') ? 'Irving' : cityLabel,
      dealerState: home.code,
      distanceMiles: 14,
      advertisedPriceUsd: 38290,
      daysOnMarket: 54,
      priceDropCount: 1,
      priceDropTotalUsd: 850,
      listingUrl: null,
      isLiveApi: false,
    },
    {
      id: 'preview-3',
      vin: '2T3P1RFV4RW609311',
      year: yearNum,
      make,
      model,
      trim,
      exteriorColor: color,
      dealerName: `Out-of-Market Direct Fleet Store (Sample)`,
      dealerCity: 'Regional Delivery',
      dealerState: 'OH',
      distanceMiles: 92,
      advertisedPriceUsd: 36950,
      daysOnMarket: 67,
      priceDropCount: 2,
      priceDropTotalUsd: 1650,
      listingUrl: null,
      isLiveApi: false,
    },
    {
      id: 'preview-4',
      vin: '2T3P1RFV7RW712445',
      year: yearNum,
      make,
      model,
      trim,
      exteriorColor: color,
      dealerName: `Metro Flagship Dealership (Sample)`,
      dealerCity: q.zip.startsWith('75') ? 'Dallas' : cityLabel,
      dealerState: home.code,
      distanceMiles: 8,
      advertisedPriceUsd: 39850,
      daysOnMarket: 11,
      priceDropCount: 0,
      priceDropTotalUsd: 0,
      listingUrl: null,
      isLiveApi: false,
    },
  ];

  return samples
    .map((s) => enrichOtdAndLeverage(s, home.code))
    .sort((a, b) => b.leverageScore - a.leverageScore);
}

async function fetchJsonTimeout<T>(url: string, headers: Record<string, string> = {}, ms = 7000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchVehicleInventory(
  query: InventorySearchQuery,
  db: AuditDatabase,
  env: NodeJS.ProcessEnv = process.env
): Promise<InventorySearchResponse> {
  const normalized: InventorySearchQuery = {
    year: String(query.year || '2026').trim().slice(0, 4),
    make: String(query.make || 'Toyota').trim().slice(0, 40),
    model: String(query.model || 'RAV4').trim().slice(0, 50),
    trim: String(query.trim || '').trim().slice(0, 50),
    color: String(query.color || '').trim().slice(0, 30),
    zip: String(query.zip || '75201').replace(/\D/g, '').slice(0, 5) || '75201',
    radiusMiles: Math.max(10, Math.min(500, Number(query.radiusMiles) || 100)),
    homeStateCode: String(query.homeStateCode || 'TX').toUpperCase().slice(0, 2),
  };

  const deepLinks = buildMultiSiteDeepLinks(normalized);
  const querySummary = [
    normalized.color,
    normalized.year,
    normalized.make,
    normalized.model,
    normalized.trim,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const cacheKey = [
    normalized.year,
    normalized.make.toLowerCase(),
    normalized.model.toLowerCase(),
    normalized.trim.toLowerCase(),
    normalized.color.toLowerCase(),
    normalized.zip,
    normalized.radiusMiles,
    normalized.homeStateCode,
  ].join('|');

  const cached = db.getInventoryCache(cacheKey);
  if (cached) {
    return {
      ...(cached.payload as InventorySearchResponse),
      cached: true,
      cacheExpiresUtc: cached.expiresUtc,
    };
  }

  const mcKey = env.MARKETCHECK_API_KEY?.trim() || '';
  const autoDevKey = env.AUTO_DEV_API_KEY?.trim() || '';

  // 1. Live MarketCheck API (500 free calls/mo — includes real Days on Market!)
  if (mcKey && !mcKey.startsWith('MY_')) {
    try {
      const qs = new URLSearchParams({
        api_key: mcKey,
        year: normalized.year,
        make: normalized.make,
        model: normalized.model,
        zip: normalized.zip,
        radius: String(Math.min(100, normalized.radiusMiles)),
        rows: '12',
        sort_by: 'dom',
        sort_order: 'desc',
      });
      if (normalized.trim) qs.set('trim', normalized.trim);
      if (normalized.color) qs.set('exterior_color', normalized.color);

      const data = await fetchJsonTimeout<{ listings?: Array<any> }>(
        `https://mc-api.marketcheck.com/v2/search/car/active?${qs.toString()}`
      );
      const list = (data.listings || []).slice(0, 10).map((item, idx) =>
        enrichOtdAndLeverage(
          {
            id: String(item.id || `mc-${idx}`),
            vin: String(item.vin || 'N/A'),
            year: Number(item.build?.year || normalized.year),
            make: String(item.build?.make || normalized.make),
            model: String(item.build?.model || normalized.model),
            trim: String(item.build?.trim || normalized.trim || 'Standard'),
            exteriorColor: String(item.exterior_color || normalized.color || 'Unspecified'),
            dealerName: String(item.dealer?.name || 'Franchise Dealership'),
            dealerCity: String(item.dealer?.city || ''),
            dealerState: String(item.dealer?.state || normalized.homeStateCode),
            distanceMiles: typeof item.dist === 'number' ? Math.round(item.dist) : null,
            advertisedPriceUsd: Math.round(Number(item.price || item.msrp || 36000)),
            daysOnMarket: Math.max(0, Math.round(Number(item.dom || item.dom_active || 15))),
            priceDropCount: Number(item.price_change_count || 0),
            priceDropTotalUsd: Math.max(0, Math.round(Number(item.price_drop || 0))),
            listingUrl: typeof item.vdp_url === 'string' ? item.vdp_url : null,
            isLiveApi: true,
          },
          normalized.homeStateCode
        )
      );

      if (list.length > 0) {
        const resp: InventorySearchResponse = {
          mode: 'LIVE_MARKETCHECK',
          cached: false,
          cacheExpiresUtc: null,
          querySummary,
          deepLinks,
          listings: list.sort((a, b) => b.leverageScore - a.leverageScore),
          apiSetupHint: null,
        };
        const expiresUtc = db.setInventoryCache(cacheKey, resp, 6 * 60 * 60);
        return { ...resp, cacheExpiresUtc: expiresUtc };
      }
    } catch (err) {
      console.warn('[InventorySearch] MarketCheck lookup failed, trying fallback:', err);
    }
  }

  // 2. Live Auto.dev API (1,000 free calls/mo — no credit card!)
  if (autoDevKey && !autoDevKey.startsWith('MY_')) {
    try {
      const qs = new URLSearchParams({
        year_min: normalized.year,
        year_max: normalized.year,
        make: normalized.make,
        model: normalized.model,
        location: normalized.zip,
        radius: String(normalized.radiusMiles),
        page: '1',
      });
      if (normalized.color) qs.set('exterior_color', normalized.color);

      const data = await fetchJsonTimeout<{ records?: Array<any> }>(
        `https://auto.dev/api/listings?${qs.toString()}`,
        { Authorization: `Bearer ${autoDevKey}`, Accept: 'application/json' }
      );

      const list = (data.records || []).slice(0, 10).map((item, idx) =>
        enrichOtdAndLeverage(
          {
            id: String(item.id || `ad-${idx}`),
            vin: String(item.vin || 'N/A'),
            year: Number(item.year || normalized.year),
            make: String(item.make || normalized.make),
            model: String(item.model || normalized.model),
            trim: String(item.trim || normalized.trim || 'Standard'),
            exteriorColor: String(item.exteriorColor || normalized.color || 'Unspecified'),
            dealerName: String(item.dealerName || 'Dealer Inventory'),
            dealerCity: String(item.city || ''),
            dealerState: String(item.state || normalized.homeStateCode),
            distanceMiles: typeof item.distanceFromOrigin === 'number' ? Math.round(item.distanceFromOrigin) : null,
            advertisedPriceUsd: Math.round(Number(item.priceUnformatted || 36000)),
            daysOnMarket: Math.max(1, Math.round(Number(item.daysOnMarket || 30))),
            priceDropCount: Number(item.priceDropCount || 0),
            priceDropTotalUsd: Math.max(0, Math.round(Number(item.priceDropAmount || 0))),
            listingUrl: typeof item.clickoffUrl === 'string' ? item.clickoffUrl : null,
            isLiveApi: true,
          },
          normalized.homeStateCode
        )
      );

      if (list.length > 0) {
        const resp: InventorySearchResponse = {
          mode: 'LIVE_AUTODEV',
          cached: false,
          cacheExpiresUtc: null,
          querySummary,
          deepLinks,
          listings: list.sort((a, b) => b.leverageScore - a.leverageScore),
          apiSetupHint: null,
        };
        const expiresUtc = db.setInventoryCache(cacheKey, resp, 6 * 60 * 60);
        return { ...resp, cacheExpiresUtc: expiresUtc };
      }
    } catch (err) {
      console.warn('[InventorySearch] Auto.dev lookup failed, falling back to preview:', err);
    }
  }

  // 3. Zero-Key Mode: Instant Multi-Site Deep-Links + Interactive Leverage Preview
  const previewResp: InventorySearchResponse = {
    mode: 'PREVIEW_PLUS_DEEP_LINKS',
    cached: false,
    cacheExpiresUtc: null,
    querySummary,
    deepLinks,
    listings: buildPreviewListings(normalized),
    apiSetupHint:
      'Live multi-site deep links above work immediately ($0). Add a free AUTO_DEV_API_KEY (1,000 free calls/mo) or MARKETCHECK_API_KEY (500 free calls/mo) to .env to stream live dealer inventory directly inside these cards (with 6-hour SQLite caching).',
  };
  return previewResp;
}
