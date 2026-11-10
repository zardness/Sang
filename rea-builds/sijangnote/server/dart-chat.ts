// AI 챗봇의 OpenDART 답변.
// [추론 INF-016] 질문에 50개 기업 중 하나가 있고 "공시"나 재무 단어(매출·영업이익·순이익·부채·재무·실적)가 있으면
// OpenDART에서 바로 찾아 답합니다. 단, P02 사업 단위 질문(예: "삼성전자 HBM 매출")은 기존 P02 규칙(INF-013)이 먼저입니다.
import { Dart, DartError, Disclosure, FinTable, toEok } from "./dart.js";
import { namedCompanies, UniverseCompany } from "./universe.js";
import { agentsFor } from "./agents.js";
import { agentAnswer } from "./agent-chat.js";

const hasAgent = (t: string) => {
  const a = agentsFor(t);
  return a.p02 || a.p04;
};

const BIZ = /(?<![A-Za-z])(HBM|DRAM|NAND|SSD|DS|DX|SDC|Harman|파운드리|메모리|시스템LSI|모바일)(?![A-Za-z])/i;
const FIN = /(매출|영업이익|순이익|부채|자산|자본|재무|실적|이익률)/;
const DISC = /(공시|보고서|발표|주요사항)/;

export function dartIntent(question: string): { co: UniverseCompany; want: "disclosures" | "financials" } | null {
  const named = namedCompanies(question);
  if (named.length !== 1) return null;
  const co = named[0];
  if (agentsFor(co.ticker).p02 && BIZ.test(question)) return null;
  if (DISC.test(question) && !FIN.test(question)) return { co, want: "disclosures" };
  if (FIN.test(question)) return { co, want: "financials" };
  if (DISC.test(question)) return { co, want: "disclosures" };
  return null;
}

const eok = (v: number | null) => (v == null ? "공시 없음" : `${toEok(v)!.toLocaleString("ko-KR")}억원`);

function finText(name: string, t: FinTable) {
  const get = (k: string) => t.rows.find((r) => r.key === k)?.values.at(-1) ?? null;
  const period = t.periods.at(-1) || t.title;
  const lines = [`${name}의 ${t.title}(${t.fs}, ${period}) 기준 **매출액**은 ${eok(get("revenue"))}, **영업이익**은 ${eok(get("op"))}, **당기순이익**은 ${eok(get("net"))}입니다(공시 원문 숫자를 억원으로 반올림).`];
  const margin = t.ratios.find((r) => r.label === "영업이익률")?.value;
  const debt = t.ratios.find((r) => r.label === "부채비율")?.value;
  if (margin != null || debt != null) lines.push(`앱이 계산한 비율은 영업이익률 ${margin ?? "—"}%, 부채비율 ${debt ?? "—"}%입니다.`);
  return lines.join("\n");
}

export async function dartAnswer(question: string, d: Dart) {
  const it = dartIntent(question);
  if (!it) return null;
  const { co, want } = it;
  const steps = ["기업 찾기", want === "disclosures" ? "OpenDART 공시 검색" : "OpenDART 주요 재무", "답변 정리"];
  const base = { inferred: "INF-016", steps, quotes: [] as never[], docCount: 0 };
  if (!d.configured) {
    // 매출·실적은 키가 없어도 P02 결과로 답한다. 공시·영업이익 같은 실시간 항목은 Agent 결과에 없어 안내한다.
    if (hasAgent(co.ticker) && want === "financials" && /매출|실적/.test(question)) {
      const a = agentAnswer(question, true);
      if (a) return a;
    }
    return {
      ...base,
      answer: `${co.name}의 ${want === "disclosures" ? "최근 공시" : "재무 숫자"}는 OpenDART에서 실시간으로 가져오는데, 지금은 인증키가 설정되지 않아 불러오지 못했습니다.\nPC에서 서버로 실행할 때 앱 폴더의 dart.config.json 에 인증키를 넣고 서버를 다시 켜면 바로 답할 수 있습니다(서버 없이 여는 단일 HTML에서는 실시간 공시를 부를 수 없습니다).`,
      sources: [],
    };
  }
  try {
    if (want === "disclosures") {
      const list: Disclosure[] = (await d.disclosures(co.ticker, 30)).slice(0, 5);
      const text = list.length
        ? `${co.name}의 최근 30일 공시 ${list.length}건입니다(OpenDART 실시간).\n` + list.map((x) => `${x.date} **${x.title}** (${x.filer})`).join("\n")
        : `${co.name}은 최근 30일 동안 낸 공시가 없습니다(OpenDART 실시간).`;
      return { ...base, answer: text, sources: list.map((x) => ({ id: `dart-${x.rcept}`, title: `${x.name} · ${x.title}`, source: `OpenDART ${x.date}`, snippet: `${x.filer} 제출`, score: 1, link: x.link })) };
    }
    const f = await d.financials(co.ticker);
    const t = f.interim ?? f.annual;
    if (!t) return { ...base, answer: `${co.name}의 정기보고서 재무 숫자를 OpenDART에서 찾지 못했습니다.`, sources: [] };
    const text = [finText(co.name, t), f.interim && f.annual ? `직전 ${f.annual.title} 기준 매출액은 ${eok(f.annual.rows.find((r) => r.key === "revenue")?.values.at(-1) ?? null)}입니다.` : ""].filter(Boolean).join("\n");
    const src = [f.interim, f.annual].filter((x): x is FinTable => !!x);
    return { ...base, answer: text, sources: src.map((x) => ({ id: `dart-${x.rcept}`, title: `${co.name} ${x.title}`, source: `OpenDART 단일회사 주요계정 (${x.fs})`, snippet: x.periods.at(-1) ?? "", score: 1, link: x.link || null })) };
  } catch (e) {
    const msg = e instanceof DartError ? e.message : "OpenDART 호출 중 오류가 났습니다.";
    return { ...base, answer: `${co.name}의 정보를 OpenDART에서 가져오지 못했습니다. ${msg}`, sources: [] };
  }
}
