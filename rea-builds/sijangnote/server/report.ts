// [추론 INF-006 · 확신도 높음] 보고서 5개 항목 × 20점 채점.
// [추론 INF-007 · 확신도 중간] 위험 설명 수정 제안은 종목 지표로 채운 템플릿.
import { GLOSSARY } from "./content.js";
import { INSTRUMENTS, series, sliceRange, stats } from "./market.js";

export type Criterion = { key: string; label: string; score: number; max: 20; signals: string[] };
export type Finding = { severity: "꼭 수정" | "권장"; criterion: string; title: string; body: string; current: string | null; suggestion: string };
export type Evaluation = { total: number; criteria: Criterion[]; findings: Finding[]; inferred: string[] };

const NUM = /\d[\d,.]*\s*(%|%p|%포인트|원|조원|억원|만원|년|배|개|bp)?/;
const SOURCE = /(에 따르면|자료|공시|출처|기준|보고서|통계)/;
const COMPARE = /(보다|대비|차이|높|낮|비교|증가|감소|앞서|뒤처)/;
const RISK = /(위험|손실|하락|낙폭|환율|환차|금리|변동성|마이너스|리스크)/;
const DOWNPLAY = /(크지 않|걱정 없|안전하|괜찮을|문제없|무조건|확실히|절대)/;
const CONCLUDE = /(결론|따라서|기대|목표|전망|예상|판단|권한다|적합)/;
const ABSOLUTE = /(무조건|반드시 오른|절대|100%)/;

export const sentences = (text: string) =>
  text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

const clamp = (v: number) => Math.max(0, Math.min(20, Math.round(v)));

export function evaluate(text: string): Evaluation {
  const ss = sentences(text);
  const count = (re: RegExp) => ss.filter((s) => re.test(s));

  const evid = ss.filter((s) => NUM.test(s) && /\d/.test(s));
  const sourced = count(SOURCE);
  const termsUsed = GLOSSARY.filter((t) => text.includes(t.term)).map((t) => t.term);
  const absolutes = count(ABSOLUTE);
  const compared = ss.filter((s) => /\d/.test(s) && COMPARE.test(s));
  const risks = count(RISK);
  const downplays = count(DOWNPLAY);
  const concl = count(CONCLUDE);

  const criteria: Criterion[] = [
    { key: "evidence", label: "근거 자료", score: clamp(2 * evid.length + sourced.length), max: 20, signals: [`숫자가 있는 문장 ${evid.length}개`, `출처 표현 ${sourced.length}개`] },
    { key: "terms", label: "용어 정확성", score: clamp(5 + 1.5 * termsUsed.length - 4 * absolutes.length), max: 20, signals: [`용어 사전 단어 ${termsUsed.length}개(${termsUsed.join(", ") || "없음"})`, `단정 표현 ${absolutes.length}개`] },
    { key: "data", label: "데이터 분석", score: clamp(4 + 4 * compared.length), max: 20, signals: [`숫자 비교 문장 ${compared.length}개`] },
    { key: "risk", label: "위험 설명", score: clamp(6 + 8 * risks.length - 3 * downplays.length), max: 20, signals: [`위험 문장 ${risks.length}개`, `위험을 낮춰 말한 문장 ${downplays.length}개`] },
    { key: "outcome", label: "기대 결과", score: clamp(8 + 4 * concl.length), max: 20, signals: [`결론·기대 문장 ${concl.length}개`] },
  ];

  const findings: Finding[] = [];
  const weakest = [...criteria].sort((a, b) => a.score - b.score)[0];
  const target = matchInstrument(text);

  if (weakest.key === "risk" || downplays.length) {
    const cur = downplays[0] ?? risks[0] ?? null;
    findings.push({
      severity: weakest.key === "risk" ? "꼭 수정" : "권장",
      criterion: "위험 설명",
      title: risks.length <= 1 ? (risks.length === 0 ? "위험 요인 설명이 없습니다" : "위험 요인이 한 문장뿐입니다") : "위험을 낮춰 말한 문장이 있습니다",
      body: target?.etf?.overseas ? "환율과 금리 변화에 따른 손실 가능성 설명을 보완하세요." : "과거 하락 폭과 금리 변화에 따른 손실 가능성 설명을 보완하세요.",
      current: cur,
      suggestion: riskSuggestion(target),
    });
  }
  if (weakest.key === "evidence") findings.push({ severity: "꼭 수정", criterion: "근거 자료", title: "숫자와 출처가 부족합니다", body: "주장마다 숫자와 출처를 하나씩 붙이세요.", current: ss.find((s) => !/\d/.test(s)) ?? null, suggestion: "예: 한국거래소 공시 기준 총보수는 0.07%이다." });
  if (weakest.key === "data") findings.push({ severity: "꼭 수정", criterion: "데이터 분석", title: "비교가 없습니다", body: "다른 상품이나 지수와 숫자로 비교해 보세요.", current: ss[0] ?? null, suggestion: "예: 5년 연평균 수익률은 11%로 코스피200 ETF보다 6%포인트 높았다." });
  if (absolutes.length) findings.push({ severity: weakest.key === "terms" ? "꼭 수정" : "권장", criterion: "용어 정확성", title: "단정 표현이 있습니다", body: "투자 결과를 확정하는 표현은 피하세요.", current: absolutes[0], suggestion: absolutes[0].replace(/무조건|절대|반드시/g, "").replace(/사야 한다/, "비중을 작게 담는 것을 검토할 수 있다").trim() });
  if (weakest.key === "outcome") findings.push({ severity: "꼭 수정", criterion: "기대 결과", title: "결론이 없습니다", body: "무엇을 얼마나 기대하는지 한 문장으로 정리하세요.", current: null, suggestion: "따라서 10년 적립식으로 연 6% 안팎의 수익을 기대한다." });

  // 가장 약한 항목(꼭 수정)을 맨 앞에
  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "꼭 수정" ? -1 : 1));
  return { total: criteria.reduce((a, c) => a + c.score, 0), criteria, findings, inferred: ["INF-006", "INF-007"] };
}

function matchInstrument(text: string) {
  const t = text.replace(/\s/g, "").toLowerCase();
  const etfs = INSTRUMENTS.filter((i) => i.etf);
  return (
    etfs.find((i) => t.includes(i.name.replace(/\s/g, "").toLowerCase())) ??
    (/(s&p|에스앤피)/.test(t) ? etfs.find((i) => i.code === "SNP500") : undefined) ??
    (/반도체/.test(t) ? etfs.find((i) => i.code === "KRSEMI") : undefined) ??
    (/배당/.test(t) ? etfs.find((i) => i.code === "KRDIV") : undefined)
  );
}

export function riskSuggestion(inst = INSTRUMENTS.find((i) => i.code === "SNP500")) {
  if (!inst) return "과거 최대 하락폭과 금리·환율 변화에 따른 손실 가능성을 숫자로 적는다.";
  const s = stats(sliceRange(series(inst), "5y"));
  const mdd = Math.round(s.maxDrawdown * 100);
  return inst.etf?.overseas
    ? `과거 5년 최대 하락폭은 −${Math.abs(mdd)}%였고, 원화 강세 시 환차손이 생길 수 있다.`
    : `과거 5년 최대 하락폭은 −${Math.abs(mdd)}%였고, 금리가 오르면 추가로 하락할 수 있다.`;
}

/** 제안 문장을 현재 문장 자리에 넣은 수정본 */
export function applySuggestion(text: string, current: string | null, suggestion: string) {
  if (current && text.includes(current)) return text.replace(current, suggestion);
  return text.trimEnd() + "\n" + suggestion;
}
