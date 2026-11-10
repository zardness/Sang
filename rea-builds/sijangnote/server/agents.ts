// P02(산업·사업모델, DART)·P04(기술적 분석, Neon 시세) Agent 결과 연동.
//
// 앱은 Agent를 다시 계산하지 않습니다. Agent가 저장한 결과 폴더(p02_out / p04_out)를 읽기 전용으로 열어
// 화면에 맞게 정리만 합니다. 숫자·문장·보류는 Agent 원문 그대로 씁니다.
//  1) agents.config.json 또는 환경변수 P02_DIR / P04_DIR 이 있으면 그 폴더의 가장 최근 실행 결과를 읽습니다(출처 "PC 결과 파일").
//  2) 없으면 노트북 출력에서 뽑아 둔 server/agent-snapshot 을 씁니다(출처 "노트북 스냅샷").
// .env 와 캐시(p02_cache·p04_cache)는 열지 않습니다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findUniverse, UNIVERSE } from "./universe.js";

export type AgentId = "p02" | "p04";
/** 50개 기업 중 하나면 기업 정보. Agent 결과가 있는지는 agentAvailable 로 따로 본다. */
export const findCompany = (t: string) => findUniverse(t);

export const LEVELS = ["L1", "L2", "L3", "L4"] as const;
export const STYLES = ["conservative", "aggressive", "neutral", "undetermined"] as const;
export const LEVEL_LABEL: Record<string, string> = { L1: "입문", L2: "초급", L3: "중급", L4: "전문가" };
export const STYLE_LABEL: Record<string, string> = { conservative: "안정형", aggressive: "공격형", neutral: "중립", undetermined: "성향 미정" };
/** P04 persona_id(L2-CON) ↔ 파일 이름 성향(conservative) */
export const personaId = (level: string, style: string) => `${level}-${style === "aggressive" ? "AGG" : style === "conservative" ? "CON" : style.slice(0, 3).toUpperCase()}`;

// ── 설정 ─────────────────────────────────────────────
type Config = { p02?: string; p04?: string };
export function agentConfig(): Config {
  const cfg: Config = {};
  const file = resolve(process.env.AGENTS_CONFIG ?? "agents.config.json");
  if (existsSync(file)) {
    try {
      Object.assign(cfg, JSON.parse(readFileSync(file, "utf8")));
    } catch {
      console.warn(`[시장노트] ${file} 을 읽지 못했습니다. JSON 형식을 확인하세요.`);
    }
  }
  if (process.env.P02_DIR) cfg.p02 = process.env.P02_DIR;
  if (process.env.P04_DIR) cfg.p04 = process.env.P04_DIR;
  return cfg;
}

const SNAPSHOT = resolve(process.env.AGENT_SNAPSHOT ?? "server/agent-snapshot");

type RunDir = { kind: "pc" | "snapshot"; dir: string; run: string };
/** 가장 최근 실행 폴더(이름이 타임스탬프라 이름순 = 시간순) */
export function latestRun(agent: AgentId, ticker: string): RunDir {
  const root = agentConfig()[agent];
  if (root) {
    const out = join(root, `${agent}_out`);
    if (existsSync(out)) {
      const runs = readdirSync(out)
        .filter((n) => /^\d{8}T\d+Z$/.test(n) && existsSync(join(out, n, ticker, "result.json")))
        .sort();
      // [추론 INF-012] 가장 최근 실행이 빈 결과(주장 0개, 예: DART 호출 상한에 걸린 실행)면 그 앞의 실행을 쓴다.
      const hasClaims = (r: string) => {
        const j = readJson<AnyObj>(join(out, r, ticker, "result.json"));
        return Array.isArray(j?.claims) && (j!.claims as unknown[]).length > 0;
      };
      const run = [...runs].reverse().find(hasClaims) ?? runs.at(-1);
      if (run) return { kind: "pc", dir: join(out, run, ticker), run: `${agent}_out/${run}` };
    }
  }
  return { kind: "snapshot", dir: join(SNAPSHOT, agent, ticker), run: "" };
}

/** 이 종목의 Agent 결과가 있는가 (PC 결과 폴더 또는 노트북 스냅샷) */
export function agentAvailable(agent: AgentId, ticker: string) {
  const rd = latestRun(agent, ticker);
  if (rd.kind === "snapshot") return existsSync(join(rd.dir, "snapshot.json"));
  // 주장이 0개인 결과(게이트에서 멈췄거나 호출 상한에 걸린 실행)는 "결과 없음"으로 본다
  const j = readJson<AnyObj>(join(rd.dir, "result.json"));
  return Array.isArray(j?.claims) && (j!.claims as unknown[]).length > 0;
}
export function agentsFor(ticker: string) {
  return { p02: agentAvailable("p02", ticker), p04: agentAvailable("p04", ticker) };
}
/** Agent 결과가 하나라도 있는 기업 (Agent를 더 돌리면 자동으로 늘어남) */
export function agentCompanies() {
  return UNIVERSE.map((c) => ({ ...c, agents: agentsFor(c.ticker) })).filter((c) => c.agents.p02 || c.agents.p04);
}

/** 단일 HTML에 묶어 넣은 결과의 정보(manifest.json). 서버 모드처럼 결과 폴더를 바로 읽을 때는 null */
export function agentBundleInfo() {
  const root = agentConfig().p02;
  if (!root) return null;
  return readJson<AnyObj>(join(dirname(root), "manifest.json"));
}

// ── 공용 파서 ────────────────────────────────────────
type AnyObj = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as AnyObj[]) : []);
const str = (v: unknown) => (v == null ? "" : String(v));
/** Python json.dump 이 쓰는 NaN·Infinity(표준 JSON 아님)를 null 로 바꿔 읽는다. 문자열 안의 글자는 건드리지 않는다. */
export function parseLooseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fixed = text.replace(/("(?:[^"\\]|\\.)*")|(?<![\w.])(-?Infinity|NaN)\b/g, (m, q) => (q ? q : "null"));
    return JSON.parse(fixed) as T;
  }
}
const readJson = <T>(p: string): T | null => {
  try {
    return parseLooseJson<T>(String(readFileSync(p, "utf8")));
  } catch {
    return null;
  }
};

/** 따옴표를 지원하는 작은 CSV 파서 (BOM 제거) */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return head ? body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""]))) : [];
}
const readJsonText = <T>(t: string): T | null => {
  try {
    return parseLooseJson<T>(t);
  } catch {
    return null;
  }
};
const readCsv = (p: string) => (existsSync(p) ? parseCsv(readFileSync(p, "utf8")) : []);

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const between = (md: string, a: string, b: string) => {
  const i = md.indexOf(a), j = md.indexOf(b);
  return i >= 0 && j > i ? md.slice(i + a.length, j).trim() : "";
};

export type Claim = { id: string; type: string; status: string; text: string; source: string };
export type CriticalHold = { problem: string; limit: string; resolve: string; holdId?: string; count?: number; blocking?: boolean };
export type Hold = { id: string; code: string; cause: string; detail: string; blocking: boolean; reviewed: string };
export type ParsedReport = {
  title: string;
  meta: Record<string, string>;
  intro: string[];
  scope: string[];
  summary: string;
  critical: CriticalHold[];
  holds: Hold[];
  claims: Claim[];
  readingOrder: string[];
  questions: string[];
  limits: string[];
};

/** Agent 페르소나 보고서(.md)를 구역별로 나눈다. 구역 표시(<!-- SUMMARY:BEGIN --> 등)는 Agent가 넣은 것 */
export function parseReport(raw: string): ParsedReport {
  const md = unescape(raw.replace(/\r\n/g, "\n"));
  const title = md.match(/^# (.+)$/m)?.[1]?.trim() ?? "";
  const meta: Record<string, string> = {};
  const metaLine = md.match(/^- 보고서: (.+)$/m)?.[1] ?? "";
  for (const part of metaLine.split(" / ")) {
    const [k, ...v] = part.split(": ");
    if (v.length) meta[k.trim()] = v.join(": ").trim();
  }
  if (!meta["보고서"] && metaLine) meta["보고서"] = metaLine.split(" / ")[0];
  const rule = md.match(/^- 설명 규칙: (.+)$/m)?.[1];
  if (rule) for (const part of rule.split(" / ")) {
    const [k, v] = part.split(": ");
    if (v) meta[k.trim()] = v.trim();
    else meta["설명 규칙"] = k.trim();
  }
  const head = md.split(/^## /m)[0];
  const intro = head
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("- "));
  const section = (name: string) => {
    const m = md.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |^<!-- |^<details>|$(?![\\s\\S]))`, "m"));
    return m ? m[1] : "";
  };
  const bullets = (s: string) => s.split("\n").filter((l) => /^\s*- /.test(l)).map((l) => l.replace(/^\s*- /, "").trim());

  const critical: CriticalHold[] = [];
  for (const block of between(md, "<!-- LOCKED:CRITICAL:BEGIN -->", "<!-- LOCKED:CRITICAL:END -->").split(/\n(?=\d+\. \*\*문제\*\*)/)) {
    const problem = block.match(/\*\*문제\*\*: (.+)/)?.[1];
    if (!problem) continue;
    critical.push({
      problem: problem.trim(),
      limit: block.match(/\*\*제한되는 해석\*\*: (.+)/)?.[1]?.trim() ?? "",
      resolve: block.match(/\*\*해결 방법\*\*: (.+)/)?.[1]?.trim() ?? "",
      holdId: block.match(/보류 ID: (.+)$/m)?.[1]?.replace(/,\s*$/, "").trim(),
    });
  }

  const holdsBlock = between(md, "<!-- LOCKED:HOLDS:BEGIN -->", "<!-- LOCKED:HOLDS:END -->") || section("모든 보류");
  const holds: Hold[] = [];
  for (const m of holdsBlock.matchAll(/^- (H-\S+) \[([A-Z_]+)\] ([^:\n]+): (.*?) \(범위 [^,]*, 차단=(True|False), 검토=([^)]+)\)$/gm))
    holds.push({ id: m[1], code: m[2], cause: m[3].trim(), detail: m[4].trim(), blocking: m[5] === "True", reviewed: m[6] });
  // P02 는 "- H-…: {JSON}" 꼴로 등록부를 그대로 싣는다
  for (const m of holdsBlock.matchAll(/^- (H-[\w-]+): (\{.*\})$/gm)) {
    const h = readJsonText<AnyObj>(m[2]);
    if (h) holds.push({ id: m[1], code: str(h.code), cause: str(h.cause), detail: str(h.needed || h.reason), blocking: h.blocking === true, reviewed: str(h.review_state) });
  }
  const limitsPart = holdsBlock.includes("**가정과 한계**") ? holdsBlock.split("**가정과 한계**")[1] : holdsBlock;
  const limits = bullets(limitsPart.split("**내보내지 않은 주장**")[0]).filter((l) => !/^H-/.test(l) && !l.startsWith("보류 등록부"));

  const claims: Claim[] = [];
  const facts = between(md, "<!-- LOCKED:FACTS:BEGIN -->", "<!-- LOCKED:FACTS:END -->") || md.split(/^## 확인된 주장[^\n]*$/m)[1]?.split(/^## (?!#)/m)[0] || "";
  for (const b of facts.split(/^### /m).slice(1)) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const id = lines[0];
    const tm = lines.find((l) => l.startsWith("- 유형:"))?.match(/유형: (\S+) \/ 상태: (\S+)/);
    const text = lines.find((l, i) => i > 0 && !l.startsWith("- ") && !l.startsWith("[출처"));
    const source = lines.find((l) => l.startsWith("[출처"));
    if (id && text) claims.push({ id, type: tm?.[1] ?? "", status: tm?.[2] ?? "", text, source: source ?? "" });
  }

  return {
    title,
    meta,
    intro,
    scope: bullets(section("이 결과가 다루는 범위")),
    summary: between(md, "<!-- SUMMARY:BEGIN -->", "<!-- SUMMARY:END -->").replace(/^## 요약\s*/, ""),
    critical,
    holds,
    claims,
    readingOrder: bullets(section("읽는 순서")),
    questions: bullets(section("확인할 질문")),
    limits,
  };
}

// ── 페르소나 보고서 목록 ─────────────────────────────
export function personaFiles(dir: string) {
  const pd = join(dir, "persona_reports");
  if (!existsSync(pd)) return [] as { level: string; style: string; file: string }[];
  return readdirSync(pd)
    .map((f) => f.match(/^report_(L[1-4])_([a-z]+)\.md$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ level: m[1], style: m[2], file: join(pd, m[0]) }))
    .sort((a, b) => a.level.localeCompare(b.level) || STYLES.indexOf(a.style as never) - STYLES.indexOf(b.style as never));
}

// ── 결과 요약 (result.json 또는 스냅샷) ──────────────

function verifierRows(v: unknown): { check: string; pass: number; fail: number }[] {
  // verifierSummary 는 버전에 따라 {check: {통과: n}} 또는 [{check, status, n}] 꼴. 둘 다 받는다.
  if (Array.isArray(v)) return v.map((r: AnyObj) => ({ check: str(r.check ?? r.name), pass: Number(r.pass ?? r["통과"] ?? r.passed ?? 0), fail: Number(r.fail ?? r["실패"] ?? r.failed ?? 0) }));
  if (v && typeof v === "object") {
    const o = v as AnyObj;
    if (o.byCheck && typeof o.byCheck === "object") return verifierRows(o.byCheck);
    // {통과: 265, 실패: 0} 처럼 검사 이름 없이 합계만 있는 꼴 (P02 5.1 PC 결과)
    const tot = (k: string[]) => k.map((x) => o[x]).find((x) => typeof x === "number" || (typeof x === "string" && /^\d+$/.test(x)));
    const pass = tot(["통과", "pass", "passed"]);
    if (pass != null) return [{ check: "전체 검사", pass: Number(pass), fail: Number(tot(["실패", "fail", "failed"]) ?? 0) }];
    return Object.entries(o)
      .filter(([, x]) => x && typeof x === "object")
      .map(([k, x]) => ({ check: k, pass: Number((x as AnyObj).pass ?? (x as AnyObj)["통과"] ?? 0), fail: Number((x as AnyObj).fail ?? (x as AnyObj)["실패"] ?? 0) }));
  }
  return [];
}

const PERIOD = /(\d{4}Q[1-4])/;
const EOK = /(-?[\d,]+)억원/;

/** 합계 검증에 쓰였지만 단독 주장으로 내지 않은 숫자(예: 음수 '기타')만 표에 숨김으로 넣는다. 합계 검증 미통과 숫자는 넣지 않는다. */
const IN_RECON_SUPPRESSED = /NEGATIVE_REVENUE|합계 검증에는 포함/;
/** PC 결과의 합계·조정 행을 사업 행과 구분되는 이름으로 바꾼다 */
const SUBTOTAL_NAME: Record<string, string> = { 연결총계: "[연결] 연결 합계", 부문합계: "[소계] 부문 합계", 내부거래조정등: "[조정] 내부거래 조정 등" };
const SUBTOTAL_ORDER = ["[소계]", "[조정]", "[연결]"];
const rowOrder = (name: string) => SUBTOTAL_ORDER.findIndex((x) => name.startsWith(x));
const rowLabel = (key: string) => SUBTOTAL_NAME[key] ?? (/조정|제거/.test(key) ? `[조정] ${key}` : key);

/** P02 주장에서 사업부별 분기 표를 다시 만든다(주장 문장 속 숫자 그대로, 숨김 주장은 calculations 의 원 단위 값). */
export function segmentsFromClaims(claims: AnyObj[], suppressed: AnyObj[] = [], calculations: AnyObj[] = []) {
  const axes: Record<string, { periods: Set<string>; rows: Map<string, Map<string, { v: number; q4: boolean; hidden: boolean }>> }> = {};
  for (const c of claims) {
    const axis = str(c.axis);
    const text = str(c.text);
    const p = str(c.horizon).match(PERIOD)?.[1] ?? text.match(PERIOD)?.[1];
    const m = text.match(EOK);
    if (!axis || !p || !m || /전년 동기|증감|%/.test(text)) continue;
    const bid = str(c.businessId);
    const name = bid.startsWith(`${str(c.businessUid).split(":")[0]}_${axis}_`) ? bid.split(`_${axis}_`)[1] : bid.split("_").slice(2).join("_") || text.split("의 ")[0];
    const a = (axes[axis] ??= { periods: new Set(), rows: new Map() });
    a.periods.add(p);
    const rowName = rowLabel(name);
    if (!a.rows.has(rowName)) a.rows.set(rowName, new Map());
    a.rows.get(rowName)!.set(p, { v: Number(m[1].replace(/,/g, "")), q4: str(c.resultType) === "derived_calculation", hidden: false });
  }
  for (const sc of suppressed) {
    const axis = str(sc.axis);
    const p = str(sc.period);
    const key = str(sc.businessKey);
    if (!axis || !p || !key || !IN_RECON_SUPPRESSED.test(str(sc.reason))) continue;
    const calc = calculations.find((x) => str(x.calculationId) === `CAL-${str(sc.claimId).replace(/^C-/, "")}`);
    if (!calc || str(calc.unit) !== "KRW" || !Number.isFinite(Number(calc.result))) continue;
    const a = (axes[axis] ??= { periods: new Set(), rows: new Map() });
    a.periods.add(p);
    const rowName = rowLabel(key);
    if (!a.rows.has(rowName)) a.rows.set(rowName, new Map());
    a.rows.get(rowName)!.set(p, { v: Math.round(Number(calc.result) / 1e8), q4: str(calc.method) === "derived", hidden: true });
  }
  const out: Record<string, { periods: string[]; rows: { name: string; values: (number | null)[]; q4Derived: boolean[]; hidden?: boolean; hiddenAt?: boolean[] }[] }> = {};
  for (const [axis, a] of Object.entries(axes)) {
    const periods = [...a.periods].sort();
    const rows = [...a.rows].map(([name, m]) => {
      const row = { name, values: periods.map((p) => m.get(p)?.v ?? null), q4Derived: periods.map((p) => !!m.get(p)?.q4) };
      const hiddenAt = periods.map((p) => !!m.get(p)?.hidden);
      return hiddenAt.some(Boolean) ? { ...row, hidden: true, hiddenAt } : row;
    });
    out[axis] = { periods, rows: rows.sort((x, y) => rowOrder(x.name) - rowOrder(y.name)) };
  }
  return out;
}

/** result.json 의 criticalHolds 가 비었을 때 차단 보류를 코드별로 묶어 대신 보여 준다 */
export function criticalFromRegistry(holds: AnyObj[]) {
  const groups = new Map<string, { problem: string; limit: string; resolve: string; count: number; blocking: boolean }>();
  for (const h of holds) {
    if (h.blocking !== true && h.blocking !== "True") continue;
    const code = str(h.code);
    const g = groups.get(code);
    if (g) g.count += 1;
    else groups.set(code, { problem: code, limit: str(h.cause), resolve: str(h.detail ?? h.needed ?? h.reason), count: 1, blocking: true });
  }
  return [...groups.values()];
}

export type AgentSummary = ReturnType<typeof loadSummary>;

export function loadSummary(agent: AgentId, ticker: string) {
  const co = findCompany(ticker);
  if (!co || !agentAvailable(agent, ticker)) return null;
  const rd = latestRun(agent, ticker);
  const personas = personaFiles(rd.dir).map(({ level, style }) => ({ level, style, key: `${level}_${style}`, label: `${level} ${LEVEL_LABEL[level]} · ${STYLE_LABEL[style] ?? style}` }));
  const base = {
    agent: agent.toUpperCase() as "P02" | "P04",
    ticker,
    name: co.name,
    source: { kind: rd.kind, label: rd.kind === "pc" ? "PC 결과 파일" : "노트북 스냅샷", run: rd.run },
    personas,
  };

  if (rd.kind === "pc") {
    const r = readJson<AnyObj>(join(rd.dir, "result.json")) ?? {};
    const claims = arr(r.claims);
    const holdsArr = arr(r.holdRegistry).length ? arr(r.holdRegistry) : arr(r.holds);
    const common = {
      ...base,
      reportId: str(r.reportId),
      asOf: str(r.asOf),
      dataMode: str(r.dataMode ?? r.mode),
      codeVersion: str(r.codeVersion),
      publicationEligible: r.publication_eligible === true,
      publicationBlockers: (Array.isArray(r.publicationBlockers) ? r.publicationBlockers : []).map(str),
      counts: {
        claims: claims.length,
        suppressed: arr(r.suppressedClaims).length,
        evidence: arr(r.evidence).length,
        calculations: arr(r.calculations).length,
        holds: holdsArr.length,
        blocking: holdsArr.filter((h) => h.blocking === true || h.blocking === "True").length,
      },
      verifier: verifierRows(r.verifierSummary),
      criticalHolds: arr(r.criticalHolds).length
        ? arr(r.criticalHolds).map((h) => ({ problem: str(h.problem), limit: str(h.limit), resolve: str(h.resolve), count: Number(h.count ?? 1), blocking: h.blocking === true }))
        : criticalFromRegistry(holdsArr),
    };
    if (agent === "p02") {
      const rev = readCsv(join(rd.dir, "company_revenue.csv"))
        .filter((x) => x.period && x.api_revenue_won)
        .map((x) => ({ period: x.period, won: Number(x.api_revenue_won), method: x.api_method ?? "", rcept: x.api_rcept_no ?? "" }));
      const revenueItem = claims.map((c) => str(c.revenueItem).trim()).find(Boolean) || "매출";
      return { ...common, revenueItem, segments: segmentsFromClaims(claims, arr(r.suppressedClaims), arr(r.calculations)), companyRevenue: rev };
    }
    const obs = readCsv(join(rd.dir, "obs_table.csv")).map((x) => ({
      id: x.id ?? x.fact_id ?? x.obs_id ?? "",
      label: x["지표"] ?? x.label ?? x.name ?? x.id ?? "",
      value: Number(String(x["값"] ?? x.value ?? "").replace(/,/g, "")),
      unit: x["단위"] ?? x.unit ?? "",
      formula: x["산식"] ?? x.formula ?? "",
      window: x["구간"] ?? x.window ?? (x.start && x.end ? `${x.start}~${x.end}` : ""),
      display: x["표시"] ?? x.display ?? "",
    }));
    const trend = claims.find((c) => c.claimId === "P04_OBS_TREND");
    return {
      ...common,
      status: str(r.status),
      phase: str(trend?.text).match(/현재 (.+?)이며/)?.[1] ?? "",
      observations: obs.filter((o) => o.id),
      forecasts: arr(r.suppressedClaims).map((s) => ({ item: str(s.claimId).replace(/^P04_/, "").replace(/\.prob$/, ""), status: "held", holds: str(s.reason ?? s.detail ?? s.holdReason).split(/[,;]\s*/).filter(Boolean) })),
    };
  }

  // 노트북 스냅샷
  const s = readJson<AnyObj>(join(rd.dir, "snapshot.json")) ?? {};
  const firstReport = personaFiles(rd.dir)[0];
  const rep = firstReport ? parseReport(readFileSync(firstReport.file, "utf8")) : null;
  const src = (s.source ?? {}) as AnyObj;
  const st = (s.status ?? {}) as AnyObj;
  const counts = (s.counts ?? st) as AnyObj;
  const common = {
    ...base,
    source: { ...base.source, run: str(src.run), notebook: str(src.notebook) },
    reportId: str(st.reportId) || rep?.meta["보고서"] || "",
    asOf: rep?.meta["분석 기준일"] ?? "",
    dataMode: str(src.dataMode),
    codeVersion: agent === "p02" ? "p02-agent-5.1" : "p04-agent-1.2",
    publicationEligible: false,
    publicationBlockers: [] as string[],
    counts: { claims: Number(counts.claims ?? 0), suppressed: Number(counts.suppressed ?? 0), evidence: Number(counts.evidence ?? 0), calculations: Number(counts.calculations ?? 0), holds: Number(counts.holds ?? 0), blocking: Number(counts.blocking ?? 0) },
    verifier: arr(s.verifier).map((v) => ({ check: str(v.check), pass: Number(v.pass), fail: 0 })),
    criticalHolds: (rep?.critical ?? []).map((c) => {
      const ids: string[] = (c.holdId ?? "").match(/H-[\w-]+/g) ?? [];
      const more = Number((c.holdId ?? "").match(/외 (\d+)건/)?.[1] ?? 0);
      const reg = rep?.holds.filter((h) => ids.includes(h.id)) ?? [];
      return { ...c, count: ids.length + more || 1, blocking: reg.length ? reg.some((h) => h.blocking) : agent === "p04" };
    }),
  };
  if (agent === "p02") return { ...common, revenueItem: "매출", segments: (s.segments ?? {}) as ReturnType<typeof segmentsFromClaims>, companyRevenue: arr(s.companyRevenue) as { period: string; won: number; method: string; rcept: string }[], summaries: (s.summaries ?? {}) as Record<string, string>, queries: arr(s.queries) };
  return {
    ...common,
    status: str(st.status),
    phase: str(s.phase),
    observations: arr(s.observations) as { id: string; label: string; value: number; unit: string; formula: string; window: string; display: string }[],
    forecasts: arr(s.forecasts) as { item: string; status: string; holds: string[] }[],
    holdActions: arr(s.holdActions),
    prices: s.prices ?? null,
    askExample: s.askExample ?? null,
  };
}

/** 페르소나 보고서 하나. 없는 조합이면 가장 가까운 것(같은 수준 → 같은 성향 → 첫 번째)으로 대신하고 그 사실을 알린다 */
export function loadReport(agent: AgentId, ticker: string, level = "L2", style = "conservative") {
  const rd = latestRun(agent, ticker);
  const files = personaFiles(rd.dir);
  if (!files.length) return null;
  const exact = files.find((f) => f.level === level && f.style === style);
  const pick = exact ?? files.find((f) => f.level === level) ?? files.find((f) => f.style === style) ?? files[0];
  const raw = readFileSync(pick.file, "utf8");
  return {
    level: pick.level,
    style: pick.style,
    personaId: personaId(pick.level, pick.style),
    requested: { level, style },
    substituted: !exact,
    updated: statSync(pick.file).mtime.toISOString(),
    ...parseReport(raw),
  };
}

/**
 * [추론 INF-013 · 확신도 중간] P02 ask(ticker, query) 재현: 공시 사업 단위에 없는 항목(예: HBM)은
 * 상위 사업 매출로 대신 답하지 않고 TARGET_NOT_DISCLOSED 보류로 돌려준다.
 */
export function businessQuery(ticker: string, query: string) {
  const s = loadSummary("p02", ticker);
  if (!s || !("segments" in s)) return null;
  const norm = (x: string) => x.replace(/\s|부문|\[[^\]]*\]/g, "").toLowerCase();
  const q = norm(query);
  if (!q) return { query, found: false, matches: [], holds: ["EMPTY_QUERY: 사업 이름을 입력하세요."] };
  const matches: { axis: string; name: string; period: string; eok: number }[] = [];
  let heldByBlock = false;
  for (const [axis, t] of Object.entries(s.segments)) {
    for (const r of t.rows) {
      if (r.name.startsWith("[") || !norm(r.name).includes(q)) continue;
      const i = r.values.map((v, k) => (v == null || r.hiddenAt?.[k] ? -1 : k)).filter((k) => k >= 0).at(-1);
      if (i != null) matches.push({ axis, name: r.name, period: t.periods[i], eok: r.values[i]! });
      else if (r.hidden) heldByBlock = true;
    }
  }
  if (matches.length) return { query, found: true, matches, holds: [] as string[] };
  return { query, found: false, matches, holds: [heldByBlock ? `HIDDEN_BY_BLOCKING_HOLD: ${s.name} "${query}" ${s.revenueItem}은 공시에 있으나 차단 보류로 단독 주장에서 빠짐` : `TARGET_NOT_DISCLOSED: ${s.name} "${query}" ${s.revenueItem}이 공시 사업 단위에 없음`] };
}

const withoutName = (name: string, text: string) => {
  const m = text.match(/^\[([^\]·]+)·?[^\]]*\] (.*)$/);
  const body = m ? `${m[1].trim()}: ${m[2]}` : text;
  return body.replace(new RegExp(`^${name}\\s*`), "");
};

/** RAG 색인용: 두 Agent의 확인된 주장(대표 보고서 기준) */
export function agentDocs() {
  const docs: { id: string; title: string; source: string; text: string; link: string }[] = [];
  for (const co of agentCompanies()) {
    // 사업 구성 개요: P02 보고 부문표의 가장 최근 분기 숫자를 그대로 나열
    const p02 = loadSummary("p02", co.ticker);
    if (p02 && "segments" in p02) {
      const seg = p02.segments.reported_segment;
      const rev = p02.companyRevenue.at(-1);
      let text = "";
      if (seg) {
        const i = seg.periods.length - 1;
        const biz = seg.rows.filter((r) => !r.name.startsWith("["));
        const parts = biz.filter((r) => r.values[i] != null && !r.hiddenAt?.[i]).map((r) => `${r.name} ${r.values[i]!.toLocaleString("ko-KR")}억원`);
        const held = biz.filter((r) => r.hiddenAt?.[i]).map((r) => r.name);
        text = `사업 구성은 보고 부문 ${biz.length}개(${biz.map((r) => r.name).join(", ")})입니다. ${seg.periods[i]} 부문별 ${p02.revenueItem}은 ${parts.join(", ")}입니다.`;
        if (held.length) text += ` ${held.join(", ")} 부문의 숫자는 차단 보류로 숨겼습니다.`;
        if (p02.revenueItem !== "매출") text += ` 이 숫자는 공시 표의 '${p02.revenueItem}'이며 회사 전체 수익(수수료수익 등)과 다릅니다.`;
      } else if (rev) {
        text = `사업 구성은 단일 영업부문이라 사업부 매출이 회사 전체 연결 매출과 같습니다. ${rev.period} 연결 매출은 ${Math.round(rev.won / 1e8).toLocaleString("ko-KR")}억원입니다. 제품별(DRAM/NAND) 금액은 공시 사업 단위에 없습니다.`;
      }
      if (text) docs.push({ id: `agent-p02-${co.ticker}-overview`, title: `${co.name} 사업 분석(P02)`, source: "Agent 사업 지도", text, link: `/app/company/${co.ticker}?tab=business` });
    }
    for (const agent of ["p02", "p04"] as const) {
      const rep = loadReport(agent, co.ticker, "L2", "conservative");
      if (!rep) continue;
      const label = agent === "p02" ? "사업 분석(P02)" : "기술적 분석(P04)";
      const tab = agent === "p02" ? "business" : "technical";
      // 최근 분기 수치 주장 + 사업 지도 인용 + 관측 주장. 문장마다 회사 이름이 들어가도록 앞에 붙인다.
      const latest = rep.claims.map((c) => c.text.match(/\d{4}Q[1-4]/)?.[0]).filter(Boolean).sort().at(-1);
      const claims = rep.claims
        .filter((c) => !/전년 동기/.test(c.text) && (agent === "p04" || c.id.startsWith("C-MAP") || (latest && c.text.includes(latest))))
        .slice(0, 60);
      for (const c of claims) docs.push({ id: `agent-${agent}-${co.ticker}-${c.id}`, title: `${co.name} ${label}`, source: `Agent ${c.id}`, text: withoutName(co.name, c.text), link: `/app/company/${co.ticker}?tab=${tab}` });
    }
  }
  return docs;
}
