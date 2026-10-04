/**
 * Grain price outlook: today's futures and the futures the market is paying
 * for later delivery (the forward curve), plus a 10-year seasonal history.
 *
 * Nobody can predict prices. The deferred futures price IS the market's own
 * price for grain sold at that time, so it is the honest "predicted" price;
 * the page adds the farmer's local basis and subtracts storage and interest
 * to show what holding is likely to net. The seasonal numbers only show what
 * prices did over the same window in past years.
 *
 * Prices come from Yahoo Finance's public chart endpoint, in cents/bu.
 */

export type CropKey = "corn" | "soybeans" | "kcwheat" | "srwwheat" | "milo";

export interface CropDef {
  key: CropKey;
  name: string;
  /** Futures root traded on Yahoo (milo has no futures; it's priced off corn). */
  root: "ZC" | "ZS" | "KE" | "ZW";
  /** Contract months, 1-12. */
  months: number[];
  note?: string;
  /** Typical local basis ($/bu) as a starting point; the farmer edits it. */
  defaultBasis: number;
}

export const CROPS: CropDef[] = [
  { key: "corn", name: "Corn", root: "ZC", months: [3, 5, 7, 9, 12], defaultBasis: -0.4 },
  { key: "soybeans", name: "Soybeans", root: "ZS", months: [1, 3, 5, 7, 8, 9, 11], defaultBasis: -0.6 },
  { key: "kcwheat", name: "Wheat (KC hard red winter)", root: "KE", months: [3, 5, 7, 9, 12], defaultBasis: -0.5 },
  { key: "srwwheat", name: "Wheat (Chicago soft red)", root: "ZW", months: [3, 5, 7, 9, 12], defaultBasis: -0.6 },
  { key: "milo", name: "Milo (sorghum)", root: "ZC", months: [3, 5, 7, 9, 12], defaultBasis: -0.5,
    note: "Milo has no futures of its own; elevators price it off corn futures, so use your milo basis to corn." },
];

export const HORIZONS = [
  { key: "now", label: "Today", days: 0 },
  { key: "30", label: "30 days", days: 30 },
  { key: "60", label: "60 days", days: 60 },
  { key: "90", label: "90 days", days: 90 },
  { key: "120", label: "120 days", days: 120 },
  { key: "365", label: "1 year", days: 365 },
] as const;

const MONTH_CODES = "FGHJKMNQUVXZ"; // Jan..Dec

/**
 * The futures contract a cash sale on `date` is priced against: the first
 * contract month after the sale's month (a contract is already in delivery
 * during its own month, so cash bids have rolled to the next one by then).
 */
export function contractFor(date: Date, months: number[]): { year: number; month: number } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  for (let add = 0; add < 3; add++) {
    for (const cm of months) {
      const cy = y + add;
      if (cy > y || cm > m) return { year: cy, month: cm };
    }
  }
  return { year: y + 1, month: months[0] };
}

export function contractSymbol(root: string, c: { year: number; month: number }) {
  return `${root}${MONTH_CODES[c.month - 1]}${String(c.year).slice(-2)}`;
}

export function contractLabel(c: { year: number; month: number }) {
  return `${new Date(c.year, c.month - 1, 1).toLocaleString("en-US", { month: "short" })} ${c.year}`;
}

export interface Quote {
  symbol: string;
  /** $/bu */
  price: number;
  previousClose?: number;
  asOf?: string;
}

/** One futures contract's latest price from Yahoo (cents/bu -> $/bu). Null when it isn't trading or the feed fails. */
export async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.CBT?range=5d&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0 (FarmLedger)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const p = Number(meta?.regularMarketPrice);
    if (!(p > 0)) return null;
    return {
      symbol,
      price: p / 100,
      previousClose: meta?.chartPreviousClose ? Number(meta.chartPreviousClose) / 100 : undefined,
      asOf: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : undefined,
    };
  } catch {
    return null;
  }
}

export interface Seasonal {
  /** Average % change over the window, across past years. */
  avgPct: number;
  /** How many past years the price was higher at the end of the window. */
  upYears: number;
  years: number;
}

/**
 * From ~10 years of monthly closes on the continuous contract: starting in
 * this calendar month, how did price move over each window in past years?
 */
export async function fetchSeasonal(root: string, startMonth: number, horizonsDays: number[]): Promise<Record<number, Seasonal | null>> {
  const out: Record<number, Seasonal | null> = {};
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${root}=F?range=11y&interval=1mo`, {
      headers: { "User-Agent": "Mozilla/5.0 (FarmLedger)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const r = j?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const series = ts.map((t, i) => ({ d: new Date(t * 1000), c: closes[i] })).filter((x) => x.c != null && x.c > 0) as { d: Date; c: number }[];
    for (const days of horizonsDays) {
      const steps = Math.max(1, Math.round(days / 30.4));
      const changes: number[] = [];
      series.forEach((s, i) => {
        if (s.d.getUTCMonth() + 1 !== startMonth) return;
        const end = series[i + steps];
        if (!end) return;
        changes.push((end.c - s.c) / s.c);
      });
      out[days] = changes.length >= 3
        ? { avgPct: (changes.reduce((a, b) => a + b, 0) / changes.length) * 100, upYears: changes.filter((c) => c > 0).length, years: changes.length }
        : null;
    }
  } catch {
    for (const days of horizonsDays) out[days] = null;
  }
  return out;
}

export interface CropOutlook {
  crop: CropDef;
  points: { horizon: string; label: string; days: number; contract: string; symbol: string; futures: number | null; seasonal: Seasonal | null }[];
  asOf?: string;
}

export async function loadOutlook(today = new Date()): Promise<CropOutlook[]> {
  const startMonth = today.getMonth() + 1;
  const seasonalByRoot = new Map<string, Promise<Record<number, Seasonal | null>>>();
  const quoteCache = new Map<string, Promise<Quote | null>>();
  const quote = (s: string) => {
    if (!quoteCache.has(s)) quoteCache.set(s, fetchQuote(s));
    return quoteCache.get(s)!;
  };

  return Promise.all(CROPS.map(async (crop) => {
    if (!seasonalByRoot.has(crop.root)) {
      seasonalByRoot.set(crop.root, fetchSeasonal(crop.root, startMonth, HORIZONS.filter((h) => h.days > 0).map((h) => h.days)));
    }
    const seasonal = await seasonalByRoot.get(crop.root)!;
    let asOf: string | undefined;
    const points = await Promise.all(HORIZONS.map(async (h) => {
      const when = new Date(today.getTime() + h.days * 86400000);
      const c = contractFor(when, crop.months);
      const symbol = contractSymbol(crop.root, c);
      const q = await quote(symbol);
      if (q?.asOf && (!asOf || q.asOf > asOf)) asOf = q.asOf;
      return {
        horizon: h.key, label: h.label, days: h.days, contract: contractLabel(c), symbol,
        futures: q?.price ?? null, seasonal: h.days > 0 ? seasonal[h.days] ?? null : null,
      };
    }));
    return { crop, points, asOf };
  }));
}

/** Net $/bu from selling at a horizon: futures + basis - storage - interest on what you'd have got today. */
export function netPrice(opts: {
  futures: number; basis: number; days: number; storageCentsPerMonth: number; interestPct: number; cashToday: number;
}): number {
  const months = opts.days / 30.4;
  const storage = (opts.storageCentsPerMonth / 100) * months;
  const interest = opts.cashToday * (opts.interestPct / 100) * (opts.days / 365);
  return opts.futures + opts.basis - storage - interest;
}
