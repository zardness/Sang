// OpenDART(금융감독원 전자공시) 실시간 연동.
//
// 인증키는 이 앱 폴더 안에서만 읽습니다: 환경변수 DART_API_KEY, 또는 dart.config.json 의 {"apiKey": "..."}.
// 키는 화면·응답·로그 어디에도 내보내지 않습니다. Agent 폴더의 .env 는 열지 않습니다.
// 키가 없으면 "오프라인"으로 동작하고, 화면은 키 설정 방법을 안내합니다.
//
// [추론 INF-015] 캐시 시간(공시 목록 5분, 기업개황·재무 6시간, 고유번호 7일)과
// "가장 최근 정기보고서" 고르는 순서는 앱이 정한 규칙입니다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { findUniverse, UNIVERSE } from "./universe.js";

const BASE = "https://opendart.fss.or.kr/api";
export const VIEWER = (rcept: string) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcept}`;

const STATUS_MSG: Record<string, string> = {
  "010": "등록되지 않은 인증키입니다.",
  "011": "사용할 수 없는 인증키입니다.",
  "012": "접근할 수 없는 IP입니다.",
  "013": "조회된 데이터가 없습니다.",
  "020": "오늘 요청 한도를 넘었습니다(하루 2만 건).",
  "021": "조회 가능한 회사 개수를 넘었습니다.",
  "100": "요청 값이 올바르지 않습니다.",
  "101": "부적절한 접근입니다.",
  "800": "OpenDART 시스템 점검 중입니다.",
  "900": "OpenDART 내부 오류입니다.",
  "901": "인증키 사용 기간이 끝났습니다.",
};

export class DartError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** .env 에서 OpenDART 키로 보이는 줄만 골라 읽는다. 다른 줄(DB 비밀번호 등)은 읽어도 쓰지 않고 어디에도 남기지 않는다. */
export const DART_ENV_NAMES = ["DART_API_KEY", "OPENDART_API_KEY", "OPEN_DART_API_KEY", "DART_KEY", "OPENDART_KEY", "DART_CRTFC_KEY", "CRTFC_KEY"];
export function keyFromEnvText(text: string): string | undefined {
  for (const name of DART_ENV_NAMES) {
    const m = text.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, "m"));
    const v = m?.[1].replace(/\s+#.*$/, "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * 인증키 찾는 순서
 *  1) 환경변수 DART_API_KEY
 *  2) dart.config.json 의 apiKey
 *  3) dart.config.json 의 envFile 이 가리키는 .env (예: P02 Agent 폴더의 .env)
 *  4) 앱 폴더의 .env
 */
export function dartKey(): string | undefined {
  const env = typeof process !== "undefined" ? process.env?.DART_API_KEY : undefined;
  if (env?.trim()) return env.trim();
  const fromEnvFile = (p: string) => {
    try {
      return existsSync(p) ? keyFromEnvText(String(readFileSync(p, "utf8"))) : undefined;
    } catch {
      return undefined;
    }
  };
  try {
    const file = resolve(process.env?.DART_CONFIG ?? "dart.config.json");
    if (existsSync(file)) {
      const cfg = JSON.parse(String(readFileSync(file, "utf8"))) as { apiKey?: string; envFile?: string };
      if (cfg.apiKey?.trim() && !cfg.apiKey.includes("여기에")) return cfg.apiKey.trim();
      if (cfg.envFile) {
        const k = fromEnvFile(resolve(cfg.envFile));
        if (k) return k;
      }
    }
  } catch {
    /* 설정 파일이 깨졌으면 다음 방법으로 */
  }
  return fromEnvFile(resolve(".env"));
}

// ── zip 안의 CORPCODE.xml 꺼내기 (외부 패키지 없이) ──────────
export function unzipFirst(buf: Uint8Array): string {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip 형식이 아닙니다.");
  const cd = dv.getUint32(eocd + 16, true);
  if (dv.getUint32(cd, true) !== 0x02014b50) throw new Error("zip 중앙 디렉터리를 찾지 못했습니다.");
  const method = dv.getUint16(cd + 10, true);
  const size = dv.getUint32(cd + 20, true);
  const local = dv.getUint32(cd + 42, true);
  const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
  const data = buf.subarray(start, start + size);
  const out = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
  if (!out) throw new Error(`지원하지 않는 압축 방식(${method})입니다.`);
  return new TextDecoder("utf-8").decode(out);
}

export function parseCorpCodes(xml: string): Record<string, { corp: string; name: string }> {
  const map: Record<string, { corp: string; name: string }> = {};
  const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>\\s*([^<]*?)\\s*</${t}>`))?.[1] ?? "";
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const stock = tag(m[1], "stock_code");
    if (/^\d{6}$/.test(stock)) map[stock] = { corp: tag(m[1], "corp_code"), name: tag(m[1], "corp_name") };
  }
  return map;
}

// ── 숫자·날짜 ───────────────────────────────────────
const num = (s: unknown) => {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const dashed = (s: string) => (s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s);

export const REPRT: Record<string, string> = { "11011": "사업보고서", "11014": "3분기보고서", "11012": "반기보고서", "11013": "1분기보고서" };

/** 주요 계정 이름(회사·업종마다 표기가 조금씩 다름) */
const ACCOUNTS: { key: string; label: string; names: RegExp }[] = [
  { key: "revenue", label: "매출액", names: /^(매출액|수익\(매출액\)|영업수익|매출)$/ },
  { key: "op", label: "영업이익", names: /^영업이익(\(손실\))?$/ },
  { key: "net", label: "당기순이익", names: /^(당기순이익|당기순이익\(손실\)|분기순이익|반기순이익|분기순이익\(손실\)|반기순이익\(손실\))$/ },
  { key: "assets", label: "자산총계", names: /^자산총계$/ },
  { key: "liab", label: "부채총계", names: /^부채총계$/ },
  { key: "equity", label: "자본총계", names: /^자본총계$/ },
];

type Row = Record<string, string>;
type Body = { status?: string; total_page?: string; list?: Row[]; [k: string]: unknown };
export type Disclosure = { date: string; title: string; filer: string; rcept: string; link: string; ticker: string; name: string; note: string };
export type FinRow = { key: string; label: string; values: (number | null)[] };
export type FinTable = { title: string; report: string; year: string; fs: "연결" | "별도"; periods: string[]; rows: FinRow[]; ratios: { label: string; value: number | null; unit: string }[]; rcept: string; link: string };

export type DartDeps = { key?: string; fetch?: typeof fetch; cacheDir?: string; now?: () => Date; base?: string };

export class Dart {
  private key?: string;
  private f: typeof fetch;
  private cacheDir: string;
  private now: () => Date;
  private base: string;
  private mem = new Map<string, { at: number; v: unknown }>();
  private codes: Record<string, { corp: string; name: string }> | null = null;
  lastError: { code: string; message: string; at: string } | null = null;
  lastOk: string | null = null;

  constructor(d: DartDeps = {}) {
    this.key = "key" in d ? d.key : dartKey();
    this.f = d.fetch ?? ((...a) => fetch(...a));
    this.cacheDir = d.cacheDir ?? resolve(process.env?.DART_CACHE ?? "data/dart-cache");
    this.now = d.now ?? (() => new Date());
    // 테스트용 가짜 OpenDART 주소 (E2E). 평소에는 쓰지 않습니다.
    this.base = d.base ?? process.env?.DART_BASE ?? BASE;
  }

  get configured() {
    return !!this.key;
  }

  status() {
    return {
      configured: this.configured,
      mode: this.configured ? ("live" as const) : ("offline" as const),
      reason: this.configured ? null : "OpenDART 인증키(DART_API_KEY)가 설정되지 않았습니다.",
      lastOk: this.lastOk,
      lastError: this.lastError,
    };
  }

  private cached<T>(k: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.mem.get(k);
    if (hit && this.now().getTime() - hit.at < ttlMs) return Promise.resolve(hit.v as T);
    return load().then((v) => {
      this.mem.set(k, { at: this.now().getTime(), v });
      return v;
    });
  }

  /** OpenDART 호출. 인증키가 들어간 주소는 오류 메시지·로그에 남기지 않는다. */
  private async call(path: string, params: Record<string, string>): Promise<Response> {
    if (!this.key) throw new DartError("NOKEY", "OpenDART 인증키(DART_API_KEY)가 설정되지 않았습니다.");
    const qs = new URLSearchParams({ crtfc_key: this.key, ...params });
    let res: Response;
    try {
      res = await this.f(`${this.base}/${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
    } catch {
      throw this.fail("NET", "OpenDART에 연결하지 못했습니다. 인터넷 연결을 확인하세요.");
    }
    if (!res.ok) throw this.fail(`HTTP${res.status}`, `OpenDART가 ${res.status} 응답을 보냈습니다.`);
    return res;
  }
  private fail(code: string, message: string) {
    this.lastError = { code, message, at: this.now().toISOString() };
    return new DartError(code, message);
  }
  private async json(path: string, params: Record<string, string>): Promise<Body> {
    const body = (await (await this.call(path, params)).json()) as Body;
    if (body.status === "013") return { status: "013", list: [] };
    if (body.status !== "000") throw this.fail(String(body.status), STATUS_MSG[String(body.status)] ?? `OpenDART 오류(${body.status})`);
    this.lastOk = this.now().toISOString();
    return body;
  }

  /** 종목코드 → DART 고유번호 (corpCode.xml, 7일 캐시) */
  async corpCode(ticker: string): Promise<string | null> {
    if (!this.codes) {
      const file = join(this.cacheDir, "corpcode.json");
      try {
        const saved = JSON.parse(String(readFileSync(file, "utf8"))) as { at: string; map: Record<string, { corp: string; name: string }> };
        if (this.now().getTime() - new Date(saved.at).getTime() < 7 * 864e5) this.codes = saved.map;
      } catch {
        /* 캐시 없음 */
      }
      if (!this.codes) {
        const res = await this.call("corpCode.xml", {});
        const buf = new Uint8Array(await res.arrayBuffer());
        const head = new TextDecoder().decode(buf.subarray(0, 200));
        if (head.includes("<status>")) {
          const code = head.match(/<status>(\d+)<\/status>/)?.[1] ?? "900";
          throw this.fail(code, STATUS_MSG[code] ?? `OpenDART 오류(${code})`);
        }
        this.codes = parseCorpCodes(unzipFirst(buf));
        this.lastOk = this.now().toISOString();
        try {
          mkdirSync(this.cacheDir, { recursive: true });
          writeFileSync(file, JSON.stringify({ at: this.now().toISOString(), map: this.codes }));
        } catch {
          /* 캐시 저장 실패는 무시 */
        }
      }
    }
    return this.codes[ticker]?.corp ?? null;
  }

  private async corpOrThrow(ticker: string) {
    const corp = await this.corpCode(ticker);
    if (!corp) throw new DartError("NOCORP", `${findUniverse(ticker)?.name ?? ticker}의 DART 고유번호를 찾지 못했습니다.`);
    return corp;
  }

  private toDisclosure = (r: Row): Disclosure => {
    const co = findUniverse(r.stock_code);
    return { date: dashed(r.rcept_dt), title: r.report_nm.replace(/\s+/g, " ").trim(), filer: r.flr_nm, rcept: r.rcept_no, link: VIEWER(r.rcept_no), ticker: r.stock_code, name: co?.name ?? r.corp_name, note: r.rm ?? "" };
  };

  /** 한 기업의 최근 공시 (기본 90일, 5분 캐시) */
  disclosures(ticker: string, days = 90): Promise<Disclosure[]> {
    return this.cached(`disc:${ticker}:${days}`, 5 * 60e3, async () => {
      const corp = await this.corpOrThrow(ticker);
      const end = this.now();
      const bgn = new Date(end.getTime() - days * 864e5);
      const body = await this.json("list.json", { corp_code: corp, bgn_de: ymd(bgn), end_de: ymd(end), page_count: "100" });
      return (body.list ?? []).map(this.toDisclosure);
    });
  }

  /** 50개 기업의 최근 공시를 한 번에 (코스피 전체 공시에서 골라냄, 5분 캐시) */
  feed(days = 3): Promise<Disclosure[]> {
    return this.cached(`feed:${days}`, 5 * 60e3, async () => {
      const end = this.now();
      const bgn = new Date(end.getTime() - days * 864e5);
      const out: Disclosure[] = [];
      const want = new Set(UNIVERSE.map((c) => c.ticker));
      for (let page = 1; page <= 10; page++) {
        const body = await this.json("list.json", { corp_cls: "Y", bgn_de: ymd(bgn), end_de: ymd(end), page_no: String(page), page_count: "100" });
        for (const r of body.list ?? []) if (want.has(r.stock_code)) out.push(this.toDisclosure(r));
        if (page >= Number(body.total_page ?? 1)) break;
      }
      return out;
    });
  }

  /** 기업개황 (6시간 캐시) */
  overview(ticker: string) {
    return this.cached(`ov:${ticker}`, 6 * 3600e3, async () => {
      const raw = await this.json("company.json", { corp_code: await this.corpOrThrow(ticker) });
      const b = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v : ""])) as Row;
      const hm = (b.hm_url ?? "").trim();
      return {
        corpName: b.corp_name,
        ceo: b.ceo_nm,
        established: dashed(b.est_dt ?? ""),
        homepage: hm ? (hm.startsWith("http") ? hm : `https://${hm}`) : "",
        address: b.adres,
        fiscalMonth: b.acc_mt ? `${Number(b.acc_mt)}월` : "",
        industryCode: b.induty_code,
      };
    });
  }

  private async singleAcnt(corp: string, year: number, reprt: string) {
    const b = await this.json("fnlttSinglAcnt.json", { corp_code: corp, bsns_year: String(year), reprt_code: reprt });
    return b.list ?? [];
  }

  private table(list: Row[], year: number, reprt: string, annual: boolean): FinTable {
    const fsDiv = list.some((r) => r.fs_div === "CFS") ? "CFS" : "OFS";
    const rows = list.filter((r) => r.fs_div === fsDiv);
    const pick = (re: RegExp) => rows.filter((r) => re.test(r.account_nm.replace(/\s/g, ""))).sort((a, b) => Number(a.ord ?? 0) - Number(b.ord ?? 0))[0];
    const first = rows[0] ?? {};
    const periods = annual ? [first.bfefrmtrm_nm, first.frmtrm_nm, first.thstrm_nm].map((s) => s ?? "") : [first.frmtrm_nm ?? "전기", first.thstrm_nm ?? "당기"];
    const finRows: FinRow[] = ACCOUNTS.map((a) => {
      const r = pick(a.names);
      const values = !r ? periods.map(() => null) : annual ? [num(r.bfefrmtrm_amount), num(r.frmtrm_amount), num(r.thstrm_amount)] : [num(r.frmtrm_amount), num(r.thstrm_amount)];
      return { key: a.key, label: a.label, values };
    });
    const last = (k: string) => finRows.find((r) => r.key === k)?.values.at(-1) ?? null;
    const ratio = (a: number | null, b: number | null) => (a != null && b ? Math.round((a / b) * 1000) / 10 : null);
    const rcept = first.rcept_no ?? "";
    return {
      title: `${year}년 ${REPRT[reprt]}`,
      report: REPRT[reprt],
      year: String(year),
      fs: fsDiv === "CFS" ? "연결" : "별도",
      periods,
      rows: finRows,
      // [추론 INF-015] 비율은 공시 숫자로 앱이 계산
      ratios: [
        { label: "영업이익률", value: ratio(last("op"), last("revenue")), unit: "%" },
        { label: "부채비율", value: ratio(last("liab"), last("equity")), unit: "%" },
      ],
      rcept,
      link: rcept ? VIEWER(rcept) : "",
    };
  }

  /** 주요 재무: 가장 최근 사업보고서(3개년) + 그 뒤 가장 최근 분·반기 보고서 (6시간 캐시) */
  financials(ticker: string) {
    return this.cached(`fin:${ticker}`, 6 * 3600e3, async () => {
      const corp = await this.corpOrThrow(ticker);
      const y = this.now().getFullYear();
      let annual: FinTable | null = null;
      for (const year of [y - 1, y - 2]) {
        const list = await this.singleAcnt(corp, year, "11011");
        if (list.length) {
          annual = this.table(list, year, "11011", true);
          break;
        }
      }
      let interim: FinTable | null = null;
      const tries: [number, string][] = [[y, "11014"], [y, "11012"], [y, "11013"]];
      if (!annual || Number(annual.year) < y - 1) tries.push([y - 1, "11014"], [y - 1, "11012"], [y - 1, "11013"]);
      for (const [year, r] of tries) {
        if (annual && year <= Number(annual.year)) continue;
        const list = await this.singleAcnt(corp, year, r);
        if (list.length) {
          interim = this.table(list, year, r, false);
          break;
        }
      }
      return { annual, interim };
    });
  }
}

let shared: Dart | null = null;
/** 서버 전체에서 쓰는 OpenDART 연결 (키가 바뀌면 서버를 다시 켜야 합니다) */
export const dart = () => (shared ??= new Dart());
export const setDart = (d: Dart | null) => {
  shared = d;
};

/** 억원 단위 표시용 */
export const toEok = (won: number | null) => (won == null ? null : Math.round(won / 1e8));
