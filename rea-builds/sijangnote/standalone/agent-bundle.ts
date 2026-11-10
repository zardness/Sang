// 단일 HTML에 Agent 결과를 넣을 때 쓰는 슬림·복원 함수 (파일을 직접 읽지 않는 순수 함수).
// 숫자나 문장을 고치지 않습니다. server/agents.ts 가 쓰지 않는 필드·구역만 빼고, 같은 글은 한 번만 넣습니다.
// 빼도 화면·챗봇 결과가 같은지는 scripts/bundle-agent-results.ts 가 원본과 비교해 확인합니다.
type AnyObj = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as AnyObj[]) : []);
const pick = (o: AnyObj, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
/** 개수만 쓰는 배열: 길이만 남긴다 */
const zeros = (v: unknown) => arr(v).map(() => 0);

const TOP = ["reportId", "asOf", "dataMode", "mode", "codeVersion", "publication_eligible", "publicationBlockers", "verifierSummary", "criticalHolds", "status"];
const IN_RECON = /NEGATIVE_REVENUE|합계 검증에는 포함/;

export function slimResult(agent: "p02" | "p04", r: AnyObj): AnyObj {
  const hasCritical = arr(r.criticalHolds).length > 0;
  const hold = (h: AnyObj) => (hasCritical ? pick(h, ["blocking"]) : pick(h, ["blocking", "code", "cause", "detail", "needed", "reason"]));
  const out: AnyObj = { ...pick(r, TOP), evidence: zeros(r.evidence), holdRegistry: arr(r.holdRegistry).map(hold) };
  if (!arr(r.holdRegistry).length) out.holds = arr(r.holds).map(hold);

  if (agent === "p04") {
    out.claims = arr(r.claims).map((c) => (c.claimId === "P04_OBS_TREND" ? pick(c, ["claimId", "text"]) : 0));
    out.suppressedClaims = arr(r.suppressedClaims).map((s) => pick(s, ["claimId", "reason", "detail", "holdReason"]));
    out.calculations = zeros(r.calculations);
    return out;
  }
  // P02: 사업부 표를 만드는 데 쓰는 주장·숨김 주장·계산만 남긴다
  let revenueItemKept = false;
  out.claims = arr(r.claims).map((c) => {
    const text = String(c.text ?? "");
    const inTable = !!c.axis && /\d{4}Q[1-4]/.test(`${c.horizon ?? ""} ${text}`) && /억원/.test(text) && !/전년 동기|증감|%/.test(text);
    if (inTable) {
      if (String(c.revenueItem ?? "").trim()) revenueItemKept = true;
      return pick(c, ["axis", "text", "horizon", "businessId", "businessUid", "resultType", "revenueItem"]);
    }
    if (!revenueItemKept && String(c.revenueItem ?? "").trim()) {
      revenueItemKept = true;
      return pick(c, ["revenueItem"]);
    }
    return 0;
  });
  const calcIds = new Set<string>();
  out.suppressedClaims = arr(r.suppressedClaims).map((s) => {
    if (!s.axis || !s.period || !s.businessKey || !IN_RECON.test(String(s.reason ?? ""))) return 0;
    calcIds.add(`CAL-${String(s.claimId).replace(/^C-/, "")}`);
    return pick(s, ["axis", "period", "businessKey", "reason", "claimId"]);
  });
  out.calculations = arr(r.calculations).map((c) => (calcIds.has(String(c.calculationId)) ? pick(c, ["calculationId", "unit", "result", "method"]) : 0));
  return out;
}

const SHARED_BLOCKS = ["LOCKED:CRITICAL", "LOCKED:HOLDS", "LOCKED:FACTS"];
const block = (key: string) => new RegExp(`<!-- ${key}:BEGIN -->[\\s\\S]*?<!-- ${key}:END -->`);

const UNREAD_SECTION = /^## (?:검증·재현 상세|용어 해설|검토 맥락)[^\n]*\n[\s\S]*?(?=^## |^<!-- |^<\/?details|$(?![\s\S]))/gm;
const HOLD_FIELDS = ["code", "cause", "needed", "reason", "blocking", "review_state"];
/** parseReport 가 읽지 않는 구역·줄·필드를 뺀다 */
function dropUnread(md: string) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(block("LOCKED:EVIDENCE"), "")
    .replace(UNREAD_SECTION, "")
    .replace(/^- (?:근거 ID|산식 ID):.*\n/gm, "")
    .replace(/^- (H-[\w-]+): (\{.*\})$/gm, (line, id, json) => {
      try {
        return `- ${id}: ${JSON.stringify(pick(JSON.parse(json) as AnyObj, HOLD_FIELDS))}`;
      } catch {
        return line;
      }
    });
}

/**
 * 페르소나 보고서 슬림: 화면이 읽지 않는 구역("주장별 근거·산식 상세"·"검증·재현 상세"·"용어 해설"·"검토 맥락")을 빼고,
 * 16개 보고서에 똑같이 들어 있는 구역은 _shared.json 에 한 번만 넣고 자리 표시만 남긴다.
 */
export function slimPersonas(files: { name: string; md: string }[]) {
  const shared: Record<string, string> = {};
  let texts = files.map((f) => dropUnread(f.md));
  for (const key of SHARED_BLOCKS) {
    const count = new Map<string, number>();
    for (const t of texts) {
      const m = t.match(block(key))?.[0];
      if (m) count.set(m, (count.get(m) ?? 0) + 1);
    }
    const top = [...count].sort((a, b) => b[1] - a[1])[0];
    if (!top) continue;
    shared[key] = top[0];
    texts = texts.map((t) => (t.includes(top[0]) ? t.replace(top[0], () => `<!--@shared:${key}-->`) : t));
  }
  return { files: files.map((f, i) => ({ name: f.name, md: texts[i] })), shared };
}

/** 자리 표시를 공유 구역으로 되돌린다 */
export const expandShared = (md: string, shared: Record<string, string>) => md.replace(/<!--@shared:([A-Z:]+)-->/g, (m, k) => shared[k] ?? m);

/** 단일 HTML 화면에 보여 줄 묶음 정보 (manifest.json) */
export type BundleRun = { run: string; tickers: string[]; codeVersion: string; codeHash: string; codeMatchesPackage: boolean; asOf: string[]; notebooks: string[] };
export type BundleManifest = {
  bundledAt: string;
  finals: { p02: string; p04: string };
  agents: Record<"p02" | "p04", { companies: number; missing: string[]; runs: BundleRun[] }>;
  finalRerun: { agent: string; ticker: string; name: string; run: string; notebook: string }[];
  note: string;
  slim: { rawBytes: number; slimBytes: number; removed: string[] };
};
