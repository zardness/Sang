// [추론 INF-005 · 확신도 중간] 한국어 문자 2-gram TF-IDF + 코사인 유사도 검색과 추출식 답변.
// 원본은 임베딩 검색 + LLM일 가능성이 있지만, 외부 서비스 없이 동작하도록 설명 가능한 방식으로 구현했습니다.
import { CHAPTERS, EXTRA_DOCS, GLOSSARY } from "./content.js";
import { INSTRUMENTS, quote } from "./market.js";
import { agentCompanies, agentDocs, businessQuery } from "./agents.js";
import { asItem, provenance, revenueItemOf } from "./agent-chat.js";
import { namedCompanies } from "./universe.js";

export type Doc = { id: string; title: string; source: string; text: string; link?: string };

const STOP = new Set(["하면", "좋아", "어요", "까요", "나요", "는데", "에서", "으로", "합니", "니다", "있습", "습니"]);

export function tokens(text: string): string[] {
  const clean = text.toLowerCase().replace(/\{\{|\}\}/g, "").replace(/[^0-9a-z가-힣&]+/g, " ");
  const out: string[] = [];
  for (const word of clean.split(" ").filter(Boolean)) {
    if (word.length === 1) { out.push(word); continue; }
    for (let i = 0; i < word.length - 1; i++) {
      const bg = word.slice(i, i + 2);
      if (!STOP.has(bg)) out.push(bg);
    }
  }
  return out;
}

export function buildDocs(): Doc[] {
  const docs: Doc[] = [];
  for (const ch of CHAPTERS) {
    ch.body.forEach((p, i) =>
      docs.push({ id: `${ch.id}-p${i + 1}`, title: `${ch.ord}장 ${ch.title}`, source: `학습 문서 · ${i + 2}쪽`, text: p.replace(/\{\{|\}\}/g, ""), link: `/app/learn/${ch.id}` }),
    );
  }
  for (const t of GLOSSARY) docs.push({ id: `term-${t.term}`, title: `용어 사전: ${t.term}`, source: "용어 사전", text: t.def });
  EXTRA_DOCS.forEach((d, i) => docs.push({ id: `extra-${i}`, ...d }));
  for (const inst of INSTRUMENTS.filter((i) => i.etf)) {
    const e = inst.etf!;
    docs.push({
      id: `inst-${inst.code}`,
      title: `${inst.name} 종목 정보`,
      source: "종목 정보",
      text: `${inst.name}${inst.name.includes(e.category) ? "" : `(${e.category})`}의 총보수 ${e.ter}%, 순자산 ${e.aum}, 추적 오차 ${e.trackingError}%, 분배금 ${e.distribution} 지급, 상장일 ${e.listed}, 구성 종목 ${e.holdings}개.`,
      link: `/app/etf/${inst.code}`,
    });
  }
  // P02·P04 Agent가 확인한 주장(Verifier 통과 문장)도 참고서로 쓴다 (INF-012)
  docs.push(...agentDocs());
  return docs;
}

type Vec = Map<string, number>;

export class Index {
  docs: Doc[];
  idf = new Map<string, number>();
  vecs: Vec[];
  constructor(docs: Doc[]) {
    this.docs = docs;
    const df = new Map<string, number>();
    const tfs = docs.map((d) => {
      const tf = new Map<string, number>();
      for (const t of tokens(d.title + " " + d.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      return tf;
    });
    const n = docs.length;
    for (const [t, c] of df) this.idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
    this.vecs = tfs.map((tf) => this.weigh(tf));
  }
  private weigh(tf: Map<string, number>): Vec {
    const v: Vec = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * (this.idf.get(t) ?? 0);
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  }
  vector(text: string): Vec {
    const tf = new Map<string, number>();
    for (const t of tokens(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return this.weigh(tf);
  }
  static cos(a: Vec, b: Vec) {
    let s = 0;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    for (const [t, w] of small) s += w * (big.get(t) ?? 0);
    return s;
  }
  search(q: string, k = 3) {
    const qv = this.vector(q);
    return this.docs
      .map((d, i) => ({ doc: d, score: Index.cos(qv, this.vecs[i]) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

let index: Index | null = null;
export const getIndex = () => (index ??= new Index(buildDocs()));

const splitSentences = (t: string) => t.split(/(?<=[.!?"”])\s+|(?<=(?:니다|어요|해요|세요|이다|한다))\s+/).map((s) => s.trim()).filter((s) => s.length > 4);

export function answer(question: string) {
  const idx = getIndex();
  // 질문에 기업 이름이 있으면 다른 기업의 Agent 문서는 빼고 찾는다 (INF-012)
  // "SK하이닉스"에서 "SK"를 따로 잡지 않도록 긴 이름을 고르고, 50개 기업의 비슷한 문장에 밀리지 않게 전체에서 거른 뒤 상위를 쓴다
  const withAgent = new Set(agentCompanies().map((co) => co.ticker));
  const named = namedCompanies(question).filter((co) => withAgent.has(co.ticker));
  const other = (id: string) => named.length > 0 && /^agent-p0\d-\d{6}-/.test(id) && !named.some((co) => id.includes(`-${co.ticker}-`));
  // 기업 이름을 말했으면 그 기업의 Agent 문서를 먼저 쓴다 ("LG 최대낙폭"이 다른 참고서 문장에 밀리지 않게)
  const ranked = idx.search(question, named.length ? idx.docs.length : 12).filter((h) => !other(h.doc.id));
  const own = named.length ? ranked.filter((h) => h.doc.id.startsWith("agent-")) : [];
  const hits = (own.length ? own : ranked).slice(0, 3);
  const steps = ["참고서 검색"];
  const qv = idx.vector(question);

  // 질문에 종목·지수 이름이 있으면 시세를 함께 조회
  const mentioned = INSTRUMENTS.filter((i) => question.replace(/\s/g, "").includes(i.name.replace(/\s/g, "")));
  const quotes = mentioned.map(quote);
  if (quotes.length) steps.push("시세 조회");
  steps.push("답변 정리");

  // 상위 문서의 문장 중 질문과 가장 닮은 문장을 골라 원래 순서대로 잇는다
  const wantsEtfFacts = quotes.length > 0 || /(얼마|보수율|순자산|상장일|추적 오차는)/.test(question);
  const cands = hits.filter((h) => wantsEtfFacts || !h.doc.id.startsWith("inst-")).flatMap((h, hi) =>
    splitSentences(h.doc.text).map((s, si) => ({ id: h.doc.id, s: h.doc.id.startsWith("agent-") ? `${h.doc.title.split(" ")[0]} ${s}` : s, score: Index.cos(qv, idx.vector(s)) + (hi === 0 ? 0.05 : 0), order: hi * 100 + si })),
  );
  const pickedCands = cands
    .sort((a, b) => b.score - a.score)
    .filter((c, i, arr) => arr.findIndex((x) => x.s === c.s) === i)
    .filter((c, _i, arr) => c.score >= arr[0].score * 0.5)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order);
  const picked = pickedCands.map((c) => c.s);

  // 정의를 묻는 질문이면 용어 사전 정의를 맨 앞에 둔다
  const defTerm = /(뭐야|무엇|뜻|란\?|이란|가 뭐|이 뭐|설명)/.test(question) ? GLOSSARY.find((t) => question.includes(t.term)) : undefined;
  if (defTerm) {
    const def = `${defTerm.term}(${defTerm.en})는 ${defTerm.def.replace(/입니다\.$/, "입니다.")}`;
    picked.splice(0, picked.length, def, ...picked.filter((s) => !s.includes(defTerm.def)).slice(0, 2));
    if (!hits.some((h) => h.doc.id === `term-${defTerm.term}`)) {
      const d = idx.docs.find((x) => x.id === `term-${defTerm.term}`)!;
      hits.unshift({ doc: d, score: Index.cos(qv, idx.vector(d.title + " " + d.text)) });
      hits.splice(3);
    }
  }
  let text = picked.length ? picked.join("\n") : "참고서에서 관련 내용을 찾지 못했습니다. 다른 표현으로 다시 물어봐 주세요.";

  let usedBiz = false;
  // [추론 INF-013] 기업 + 사업 이름 + 매출을 물으면 P02 사업 질의 규칙을 먼저 적용한다.
  // 공시 사업 단위에 없는 항목(HBM 등)은 상위 사업 매출로 대신 답하지 않는다.
  const bizTerm = question.match(/(?<![A-Za-z])(HBM|DRAM|NAND|SSD|DS|DX|SDC|Harman|파운드리|메모리|시스템LSI|모바일)(?![A-Za-z])/i)?.[1];
  if (named.length === 1 && bizTerm && /매출|실적|얼마|공시/.test(question)) {
    const r = businessQuery(named[0].ticker, bizTerm);
    if (r) {
      steps.splice(1, 0, "사업 질의(P02)");
      const ref = picked.find((x) => x.toUpperCase().includes(bizTerm.toUpperCase()));
      const item = revenueItemOf(named[0].ticker);
      text = r.found
        ? r.matches.map((m) => `${named[0].name} **${m.name}**의 ${m.period} ${item}은 ${m.eok.toLocaleString("ko-KR")}억원입니다(공시 원문 그대로).`).join("\n")
        : `${named[0].name}의 "${bizTerm}" ${item}은 공시된 사업 단위에 없습니다. 상위 사업의 ${item} 숫자로 대신 답하지 않습니다.\n보류: ${r.holds[0]}` + (ref ? `\n참고로 공시 원문에서 ${bizTerm}이 나오는 문장입니다(${item} 숫자 아님).\n${ref}` : "");
      usedBiz = true;
    }
  }
  for (const q of quotes) {
    const v = q.unit ? `${q.last.toLocaleString("ko-KR")}원` : q.last.toLocaleString("ko-KR");
    text += `\n참고로 ${q.name}는 지금 ${v}(${q.changePct > 0 ? "+" : ""}${q.changePct}%)입니다.`;
  }
  // 용어 사전 단어를 굵게 (**용어**)
  for (const t of GLOSSARY) text = text.replaceAll(t.term, `**${t.term}**`);
  text = text.replace(/국내 지수 ETF/, "**국내 지수 ETF**").replace(/\*\*\*\*/g, "");

  // Agent 문장을 썼으면 출처(P02/P04, 실행 폴더)·검증 전·보류 이유를 함께 보여 준다 (INF-017)
  const usedAgent = new Set(pickedCands.map((c) => c.id.match(/^agent-(p0\d)-(\d{6})-/)).filter((m) => !!m).map((m) => `${m[1]}:${m[2]}`));
  if (usedBiz) usedAgent.add(`p02:${named[0].ticker}`);
  for (const key of usedAgent) {
    const [agent, ticker] = key.split(":") as ["p02" | "p04", string];
    if (agent === "p02") text = asItem(revenueItemOf(ticker), text);
    text += `\n${provenance(agent, ticker)}`;
  }

  return {
    inferred: "INF-005",
    steps,
    answer: text,
    sources: hits.map((h) => ({ id: h.doc.id, title: h.doc.title, source: h.doc.source, snippet: firstSentence(h.doc.text), score: Math.round(h.score * 100) / 100, link: h.doc.link ?? null })),
    quotes,
    docCount: idx.docs.length,
  };
}

const firstSentence = (t: string) => splitSentences(t)[0] ?? t;
