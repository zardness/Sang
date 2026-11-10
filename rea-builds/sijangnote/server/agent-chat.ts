// [추론 INF-017] 챗봇의 Agent 결과 답변.
// 질문에 기업이 하나 있고 P02·P04·부문·사업부·보류 같은 말이 있으면 문서 검색 대신 저장된 Agent 결과에서 바로 답합니다.
// 숫자는 Agent 결과 그대로이며, 답마다 출처(P02/P04, 실행 폴더)와 "검증 전", 보류 이유를 함께 붙입니다.
// 은행처럼 공시 표 항목이 '이자수익'·'순이자손익'인 기업은 '매출'이라고 부르지 않습니다.
import { AgentId, loadSummary } from "./agents.js";
import { namedCompanies, UniverseCompany } from "./universe.js";

const AGENT_NAME = { p02: "사업 분석(P02)", p04: "기술적 분석(P04)" };
const TAB = { p02: "business", p04: "technical" };
const num = (v: number) => v.toLocaleString("ko-KR");

const summaryOf = (agent: AgentId, ticker: string) => {
  try {
    return loadSummary(agent, ticker);
  } catch {
    return null;
  }
};

/** 공시 표 항목 이름. Agent 결과가 없으면 "매출" */
export function revenueItemOf(ticker: string) {
  const s = summaryOf("p02", ticker);
  return s && "revenueItem" in s ? s.revenueItem : "매출";
}
/** 항목이 '매출'이 아닌 기업은 설명 문장 속 '매출'을 공시 항목 이름으로 바꾼다 */
export const asItem = (item: string, text: string) => (item.includes("매출") ? text : text.replace(/매출(?:액)?(?!채권|원가|총이익)/g, item));

/** 답 끝에 붙이는 출처·검증 전·보류 이유 두 줄 */
export function provenance(agent: AgentId, ticker: string) {
  const s = summaryOf(agent, ticker);
  if (!s) return "";
  const item = agent === "p02" ? revenueItemOf(ticker) : "매출";
  // 차단 보류 건수는 화면과 같은 보류 등록부 기준으로 쓴다(publicationBlockers 의 건수와 다른 결과가 있음)
  const blockers = s.publicationBlockers.map((b) => (/^차단 보류 \d+건/.test(b) ? `차단 보류 ${num(s.counts.blocking)}건` : b));
  const why = blockers.length ? blockers : s.criticalHolds.map((c) => c.problem).slice(0, 2);
  const lines = [`출처: ${s.agent} · ${s.source.run || s.source.label} · 기준일 ${s.asOf || "미상"} · **검증 전**(publication_eligible=false)`];
  if (why.length) lines.push(`보류 이유: ${why.map((w) => asItem(item, w)).join(" / ")}`);
  return lines.join("\n");
}

const sourceOf = (agent: AgentId, co: UniverseCompany, snippet: string) => {
  const s = summaryOf(agent, co.ticker);
  return { id: `agent-${agent}-${co.ticker}-summary`, title: `${co.name} ${AGENT_NAME[agent]}`, source: `${agent.toUpperCase()} ${s?.source.run || s?.source.label || ""} · 검증 전`, snippet, score: 1, link: `/app/company/${co.ticker}?tab=${TAB[agent]}` };
};

function holdsAnswer(agent: AgentId, co: UniverseCompany) {
  const s = summaryOf(agent, co.ticker);
  if (!s) return `${co.name}의 ${AGENT_NAME[agent]} 결과가 없습니다.`;
  const item = agent === "p02" ? revenueItemOf(co.ticker) : "매출";
  const head = `${co.name} ${s.agent} 보류는 ${num(s.counts.holds)}건이고 그중 차단 보류가 ${num(s.counts.blocking)}건입니다. 보류된 내용은 결론에 쓰지 않습니다.`;
  const rows = s.criticalHolds.slice(0, 5).map((c) => `· **${asItem(item, c.problem)}**${c.count ? ` (${num(c.count)}건)` : ""}: ${asItem(item, c.limit)}${c.resolve ? ` → 해결: ${asItem(item, c.resolve)}` : ""}`);
  const more = s.criticalHolds.length > 5 ? [`· 그 밖의 묶음 ${s.criticalHolds.length - 5}개는 기업 화면에서 볼 수 있습니다.`] : [];
  return [head, ...rows, ...more, provenance(agent, co.ticker)].join("\n");
}

function technicalAnswer(co: UniverseCompany) {
  const s = summaryOf("p04", co.ticker);
  if (!s || !("observations" in s)) return `${co.name}의 기술적 분석(P04) 결과가 없습니다.`;
  const close = s.observations.find((o) => o.id === "OBS_CLOSE");
  const head = `${co.name} P04 기술적 분석 결과(${s.asOf} 기준): 국면은 ${s.phase ? `**${s.phase}**` : "표시 없음"}${close ? `, 종가는 ${num(close.value)}원` : ""}입니다.`;
  const wanted = /^(RSI|종가의 20일선|종가의 60일선|20거래일 수익률|20일 연환산 변동성|최근 1년 최대낙폭|거래량)/;
  const unit = (u: string) => (u === "index" ? "" : u);
  const rows = s.observations.filter((o) => wanted.test(o.label)).map((o) => `· ${o.label}: ${num(o.value)}${unit(o.unit)}`);
  const held = s.forecasts.filter((f) => f.status === "held");
  const fc = held.length ? [`예측 ${held.length}개는 모두 보류입니다(${held.map((f) => `${f.item}: ${f.holds.join(",") || "사유 표시 없음"}`).join(" / ")}). 관측 지표(과거 사실)만 보여 줍니다.`] : [];
  return [head, ...rows, ...fc, provenance("p04", co.ticker)].join("\n");
}

function segmentAnswer(co: UniverseCompany) {
  const s = summaryOf("p02", co.ticker);
  if (!s || !("segments" in s)) return `${co.name}의 사업 분석(P02) 결과가 없습니다.`;
  const item = s.revenueItem;
  const notSales = !item.includes("매출") ? [`이 숫자는 공시 표의 '${item}'이며 회사 전체 수익과 다릅니다. '매출'로 보면 안 됩니다.`] : [];
  const seg = s.segments.reported_segment ?? Object.values(s.segments)[0];
  if (!seg?.periods.length) {
    const rev = s.companyRevenue.at(-1);
    const head = rev
      ? `${co.name}: 사업부별 숫자가 Agent 결과에 없습니다. ${rev.period} 회사 전체 ${item}은 ${num(Math.round(rev.won / 1e8))}억원입니다(P02).`
      : `${co.name}: 사업부별 숫자가 Agent 결과에 없습니다(P02).`;
    return [head, ...notSales, provenance("p02", co.ticker)].join("\n");
  }
  const i = seg.periods.length - 1;
  const period = seg.periods[i];
  const biz = seg.rows.filter((r) => !r.name.startsWith("["));
  const shown = biz.filter((r) => r.values[i] != null && !r.hiddenAt?.[i]);
  const hidden = biz.filter((r) => r.hiddenAt?.[i]).map((r) => r.name);
  const empty = biz.filter((r) => r.values[i] == null).map((r) => r.name);
  const total = seg.rows.find((r) => r.name.startsWith("[연결]"))?.values[i];
  const head = `${co.name} 부문별 ${item}(${period}, P02 결과 · 검증 전)입니다.`;
  const rows = shown.map((r) => `· ${r.name}: ${num(r.values[i]!)}억원${r.q4Derived[i] ? " (누적에서 뺀 계산값)" : ""}`);
  const extra = [
    total != null ? `연결 합계: ${num(total)}억원` : "",
    hidden.length ? `${hidden.join(", ")} 부문은 차단 보류로 숫자를 숨겼습니다.` : "",
    empty.length ? `${empty.join(", ")} 부문은 ${period} 값이 없습니다.` : "",
  ].filter(Boolean);
  return [head, ...rows, ...extra, ...notSales, provenance("p02", co.ticker)].join("\n");
}

const BIZ = /(?<![A-Za-z])(HBM|DRAM|NAND|SSD|DS|DX|SDC|Harman|파운드리|메모리|시스템LSI|모바일)(?![A-Za-z])/i;
const P04 = /P04|기술적|기술\s*분석|국면/i;
const P02 = /P02|부문|사업부|사업\s*구성|사업\s*분석|이자수익|순이자|세그먼트/i;
const HOLD = /보류|발행\s*적격|검증\s*전/;

/** sales: OpenDART 키가 없을 때 "매출·실적" 질문도 P02 표로 답한다 */
export function agentIntent(question: string, sales = false): { co: UniverseCompany; want: "holds" | "technical" | "segments"; agents: AgentId[] } | null {
  const named = namedCompanies(question);
  if (named.length !== 1) return null;
  const co = named[0];
  const has = (a: AgentId) => !!summaryOf(a, co.ticker);
  if (!has("p02") && !has("p04")) return null;
  const isP04 = P04.test(question), isP02 = P02.test(question);
  if (HOLD.test(question)) {
    const agents: AgentId[] = isP04 && !isP02 ? ["p04"] : isP02 && !isP04 ? ["p02"] : ["p02", "p04"];
    return { co, want: "holds", agents };
  }
  if (isP04) return { co, want: "technical", agents: ["p04"] };
  // 삼성전자 HBM 처럼 사업 이름을 콕 집은 질문은 기존 P02 사업 질의(INF-013)가 맡는다
  if ((isP02 || sales) && !BIZ.test(question) && has("p02")) return { co, want: "segments", agents: ["p02"] };
  return null;
}

export function agentAnswer(question: string, sales = false) {
  const it = agentIntent(question, sales);
  if (!it) return null;
  const { co, want, agents } = it;
  const text = want === "technical" ? technicalAnswer(co) : want === "segments" ? segmentAnswer(co) : agents.map((a) => holdsAnswer(a, co)).join("\n\n");
  return {
    inferred: "INF-017",
    steps: ["기업 찾기", `Agent 결과 조회(${agents.map((a) => a.toUpperCase()).join("·")})`, "답변 정리"],
    answer: text,
    sources: agents.filter((a) => summaryOf(a, co.ticker)).map((a) => sourceOf(a, co, text.split("\n")[0])),
    quotes: [],
    docCount: 0,
  };
}
