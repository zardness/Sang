// 시세·지표 계산.
// [추론 INF-001 · 확신도 높음] 화면에 보인 값에 맞춘 가상 시계열. 근거: docs/INFERENCE.md

export type Kind = "index" | "fx" | "etf";
export type Instrument = {
  code: string;
  name: string;
  kind: Kind;
  region: "KR" | "US";
  last: number;
  changePct: number;
  change?: number; // 화면에 보인 전일 대비 값이 있으면 그대로 사용
  unit?: "원";
  drift: number; // 연 기대수익률
  vol: number; // 연 변동성
  seed: number;
  etf?: {
    category: string;
    ter: number; // %
    aum: string;
    trackingError: number; // %
    distribution: string;
    listed: string;
    holdings: number;
    overseas: boolean;
    top: { name: string; weight: number }[];
  };
};

export const INSTRUMENTS: Instrument[] = [
  { code: "KOSPI", name: "코스피", kind: "index", region: "KR", last: 2742.18, change: 31.4, changePct: 1.16, drift: 0.05, vol: 0.17, seed: 13 },
  { code: "KOSDAQ", name: "코스닥", kind: "index", region: "KR", last: 782.4, changePct: 0.54, drift: 0.02, vol: 0.24, seed: 12 },
  { code: "SPX", name: "S&P 500", kind: "index", region: "US", last: 6512.4, changePct: -0.2, drift: 0.1, vol: 0.16, seed: 4 },
  { code: "NDX", name: "나스닥", kind: "index", region: "US", last: 21408.11, changePct: 0.31, drift: 0.13, vol: 0.21, seed: 4 },
  { code: "USDKRW", name: "원/달러", kind: "fx", region: "KR", last: 1384.5, changePct: -0.23, drift: 0.02, vol: 0.07, seed: 15 },
  {
    code: "SNP500", name: "미국 S&P500 지수 ETF", kind: "etf", region: "US", last: 18425, change: 215, changePct: 1.18, unit: "원", drift: 0.115, vol: 0.165, seed: 10,
    etf: {
      category: "해외 지수 ETF", ter: 0.07, aum: "4.2조원", trackingError: 0.12, distribution: "분기", listed: "2020.08.07", holdings: 503, overseas: true,
      top: [{ name: "가상 테크 A", weight: 7.1 }, { name: "가상 테크 B", weight: 6.6 }, { name: "가상 반도체 C", weight: 6.2 }, { name: "가상 커머스 D", weight: 3.8 }, { name: "가상 플랫폼 E", weight: 2.6 }],
    },
  },
  {
    code: "K200", name: "코스피200 ETF", kind: "etf", region: "KR", last: 36210, changePct: 1.0, unit: "원", drift: 0.055, vol: 0.18, seed: 10,
    etf: {
      category: "국내 지수 ETF", ter: 0.05, aum: "6.8조원", trackingError: 0.08, distribution: "분기", listed: "2018.03.15", holdings: 200, overseas: false,
      top: [{ name: "가상 전자 A", weight: 24.5 }, { name: "가상 반도체 B", weight: 9.8 }, { name: "가상 배터리 C", weight: 3.9 }, { name: "가상 바이오 D", weight: 3.1 }, { name: "가상 자동차 E", weight: 2.8 }],
    },
  },
  {
    code: "NQ100", name: "나스닥100 ETF", kind: "etf", region: "US", last: 24310, changePct: 0.4, unit: "원", drift: 0.14, vol: 0.22, seed: 4,
    etf: {
      category: "해외 지수 ETF", ter: 0.07, aum: "3.1조원", trackingError: 0.15, distribution: "분기", listed: "2020.11.20", holdings: 101, overseas: true,
      top: [{ name: "가상 테크 A", weight: 8.9 }, { name: "가상 테크 B", weight: 8.1 }, { name: "가상 반도체 C", weight: 7.7 }, { name: "가상 커머스 D", weight: 5.4 }, { name: "가상 플랫폼 E", weight: 3.6 }],
    },
  },
  {
    code: "KRDIV", name: "국내 배당 ETF", kind: "etf", region: "KR", last: 12880, changePct: -0.3, unit: "원", drift: 0.06, vol: 0.13, seed: 3,
    etf: {
      category: "국내 배당 ETF", ter: 0.29, aum: "0.9조원", trackingError: 0.21, distribution: "월", listed: "2019.06.25", holdings: 30, overseas: false,
      top: [{ name: "가상 금융 A", weight: 9.2 }, { name: "가상 통신 B", weight: 8.4 }, { name: "가상 금융 C", weight: 7.9 }, { name: "가상 에너지 D", weight: 6.5 }, { name: "가상 철강 E", weight: 5.1 }],
    },
  },
  {
    code: "KRSEMI", name: "국내 반도체 ETF", kind: "etf", region: "KR", last: 15240, changePct: 2.4, unit: "원", drift: 0.09, vol: 0.32, seed: 6,
    etf: {
      category: "국내 업종 ETF", ter: 0.45, aum: "1.4조원", trackingError: 0.35, distribution: "연", listed: "2021.02.03", holdings: 25, overseas: false,
      top: [{ name: "가상 전자 A", weight: 22.1 }, { name: "가상 반도체 B", weight: 19.4 }, { name: "가상 장비 C", weight: 8.2 }, { name: "가상 소재 D", weight: 6.6 }, { name: "가상 장비 E", weight: 5.9 }],
    },
  },
];

export const WATCHLIST = ["K200", "NQ100", "KRDIV"];

// 결정적 난수 (mulberry32 + Box-Muller)
function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

export type Point = { date: string; close: number };

export function businessDays(end: Date, count: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (out.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

export const asOf = () => {
  const env = process.env.SIJANG_AS_OF;
  return env ? new Date(env + "T06:30:00Z") : new Date();
};

const TRADING_DAYS = 252;
const cache = new Map<string, Point[]>();

/** [추론 INF-001] 6년치 일간 종가. 마지막 종가와 전일 대비 등락률이 화면 값과 정확히 같도록 맞춘다. */
export function series(inst: Instrument, end = asOf()): Point[] {
  const key = `${inst.code}:${inst.seed}:${end.toISOString().slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = TRADING_DAYS * 6;
  const dates = businessDays(end, n);
  const z = rng(inst.seed);
  const dt = 1 / TRADING_DAYS;
  const mu = (inst.drift - 0.5 * inst.vol ** 2) * dt;
  const sd = inst.vol * Math.sqrt(dt);
  const logp = [0];
  for (let i = 1; i < n - 1; i++) logp.push(logp[i - 1] + mu + sd * z());
  const prevClose = prevOf(inst);
  const shift = Math.log(prevClose) - logp[n - 2];
  const pts = logp.map((v, i) => ({ date: dates[i], close: round(Math.exp(v + shift), inst) }));
  pts.push({ date: dates[n - 1], close: inst.last });
  cache.set(key, pts);
  return pts;
}

const round = (v: number, inst: Instrument) => (inst.unit === "원" ? Math.round(v) : Math.round(v * 100) / 100);

export const RANGES: Record<string, number> = { "1w": 5, "1m": 21, "1y": TRADING_DAYS, "5y": TRADING_DAYS * 5, all: Infinity };

export function sliceRange(pts: Point[], range: string, listed?: string): Point[] {
  let out = pts.slice(-Math.min(pts.length, RANGES[range] ?? TRADING_DAYS));
  if (listed) {
    const iso = listed.replaceAll(".", "-");
    out = out.filter((p) => p.date >= iso);
  }
  return out;
}

/** 차트 점이 너무 많으면 고르게 줄인다 (마지막 점은 항상 유지). */
export function downsample(pts: Point[], max = 160): Point[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
}

const prevOf = (inst: Instrument) => (inst.change !== undefined ? inst.last - inst.change : inst.last / (1 + inst.changePct / 100));

export function quote(inst: Instrument) {
  const prev = prevOf(inst);
  const change = inst.unit === "원" ? Math.round(inst.last - prev) : Math.round((inst.last - prev) * 100) / 100;
  return { code: inst.code, name: inst.name, kind: inst.kind, region: inst.region, last: inst.last, change, changePct: inst.changePct, unit: inst.unit ?? null };
}

export function stats(pts: Point[]) {
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) rets.push(Math.log(pts[i].close / pts[i - 1].close));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  let peak = pts[0].close, peakIdx = 0, mdd = 0, mddPeakIdx = 0, mddTroughIdx = 0;
  pts.forEach((p, i) => {
    if (p.close > peak) { peak = p.close; peakIdx = i; }
    const dd = p.close / peak - 1;
    if (dd < mdd) { mdd = dd; mddPeakIdx = peakIdx; mddTroughIdx = i; }
  });
  const peakVal = pts[mddPeakIdx].close;
  const recIdx = pts.findIndex((p, i) => i > mddTroughIdx && p.close >= peakVal);
  const years = pts.length / TRADING_DAYS;
  return {
    meanDaily: mean,
    sdDaily: sd,
    annualVol: sd * Math.sqrt(TRADING_DAYS),
    cagr: Math.pow(pts[pts.length - 1].close / pts[0].close, 1 / years) - 1,
    maxDrawdown: mdd,
    recoveryDays: recIdx === -1 ? null : recIdx - mddTroughIdx,
  };
}

export const find = (code: string) => INSTRUMENTS.find((i) => i.code.toLowerCase() === code.toLowerCase());
