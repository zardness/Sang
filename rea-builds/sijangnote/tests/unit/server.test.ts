import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";
import { openDb } from "../../server/db";
import { find, quote, series, sliceRange, stats } from "../../server/market";
import { forecast } from "../../server/analysis";
import { evaluate } from "../../server/report";
import { answer } from "../../server/rag";
import { SEED_REPORTS } from "../../server/content";

describe("[관찰] 화면 값 재현", () => {
  it("코스피 종가와 등락이 화면 02와 같다", () => {
    const q = quote(find("KOSPI")!);
    expect(q.last).toBe(2742.18);
    expect(q.change).toBe(31.4);
    expect(q.changePct).toBe(1.16);
    const pts = series(find("KOSPI")!);
    expect(pts.at(-1)!.close).toBe(2742.18);
    expect(pts.at(-2)!.close).toBeCloseTo(2710.78, 1);
  });
  it("S&P500 ETF 가격이 화면 03과 같다", () => {
    expect(quote(find("SNP500")!)).toMatchObject({ last: 18425, change: 215, changePct: 1.18 });
  });
});

describe("[추론 INF-003] 예측 밴드", () => {
  it("중앙값은 밴드 안에 있고, 밴드는 시간이 갈수록 넓어진다", () => {
    const f = forecast(find("SNP500")!).points;
    expect(f[0].lo).toBe(f[0].hi);
    let prev = 0;
    for (const p of f) {
      expect(p.lo).toBeLessThanOrEqual(p.median);
      expect(p.median).toBeLessThanOrEqual(p.hi);
      const w = p.hi - p.lo;
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });
});

describe("[추론 INF-004] Agent 등급 근거 지표", () => {
  it("S&P500 ETF는 5년 동안 오르고 1년 안에 회복했다", () => {
    const s = stats(sliceRange(series(find("SNP500")!), "5y"));
    expect(s.cagr).toBeGreaterThan(0.05);
    expect(s.recoveryDays).not.toBeNull();
    expect(s.recoveryDays!).toBeLessThanOrEqual(252);
  });
});

describe("[추론 INF-006] 보고서 채점", () => {
  it("5개 항목 × 20점이고 합계가 총점이다", () => {
    const e = evaluate(SEED_REPORTS[0].text);
    expect(e.criteria).toHaveLength(5);
    expect(e.criteria.every((c) => c.score >= 0 && c.score <= 20)).toBe(true);
    expect(e.total).toBe(e.criteria.reduce((a, c) => a + c.score, 0));
  });
  it("위험을 낮춰 말한 문장을 '꼭 수정'으로 잡는다", () => {
    const e = evaluate(SEED_REPORTS[0].text);
    expect(e.findings[0]).toMatchObject({ severity: "꼭 수정", criterion: "위험 설명", current: "장기적으로 보면 손실 위험은 크지 않다." });
    expect(e.findings[0].suggestion).toMatch(/최대 하락폭은 −\d+%/);
  });
  it("위험 설명을 보완하면 점수가 오른다", () => {
    const before = evaluate(SEED_REPORTS[0].text);
    const fixed = SEED_REPORTS[0].text.replace(before.findings[0].current!, before.findings[0].suggestion);
    expect(evaluate(fixed).total).toBeGreaterThan(before.total);
  });
  it("단정 표현은 용어 정확성을 깎는다", () => {
    const base = "총보수는 0.07%로 낮다. 따라서 기대한다. 환율 위험이 있다.";
    expect(evaluate(base + " 무조건 오른다.").criteria[1].score).toBeLessThan(evaluate(base).criteria[1].score);
  });
});

describe("[추론 INF-005] RAG", () => {
  it("화면 06 질문에 2장 문서를 가장 유사한 근거로 고른다", () => {
    const r = answer("장기 투자용으로 국내 ETF랑 해외 ETF 중에 뭘 먼저 공부하면 좋아?");
    expect(r.sources[0].title).toContain("국내 ETF와 해외 ETF");
    expect(r.sources[0].score).toBeGreaterThan(r.sources[1].score);
    expect(r.answer).toContain("**국내 지수 ETF**");
  });
  it("정의 질문은 용어 사전 정의로 시작한다", () => {
    expect(answer("총보수가 뭐야?").answer.startsWith("**총보수**(Total expense ratio)는")).toBe(true);
  });
});

describe("API", () => {
  let app: ReturnType<typeof createApp>;
  beforeAll(() => {
    app = createApp(openDb(":memory:"));
  });
  const json = async (path: string, init?: RequestInit) => {
    const r = await app.request(`/api${path}`, init);
    return { status: r.status, headers: r.headers, body: (await r.json()) as any };
  };

  it("추론 로직을 쓰는 응답에는 X-Rea-Inferred 헤더가 붙는다", async () => {
    const r = await json("/etfs/SNP500/forecast");
    expect(r.headers.get("x-rea-inferred")).toContain("INF-003");
  });
  it("[추론 INF-008] 총보수 계산이 화면 04의 '약 33만원'과 맞다", async () => {
    const r = await json("/calc/fee");
    expect(Math.round(r.body.difference / 10000)).toBe(33);
  });
  it("[추론 INF-009] 학습 진행: 3/7, 남은 6분, 30초 읽으면 그대로 6분(올림)", async () => {
    let r = await json("/learn");
    expect(r.body).toMatchObject({ done: 2, total: 7, remainingMin: 6, current: { ord: 3 } });
    r = await json("/learn/etf-101-3/progress", { method: "POST", body: JSON.stringify({ addSec: 90 }), headers: { "content-type": "application/json" } });
    expect(r.body.remainingMin).toBe(5);
    r = await json("/learn/etf-101-3/progress", { method: "POST", body: JSON.stringify({ done: true }), headers: { "content-type": "application/json" } });
    expect(r.body.current.ord).toBe(4);
  });
  it("보고서 업로드는 .txt/.md 만 받고, 평가해서 저장한다", async () => {
    const fd = new FormData();
    fd.append("file", new File(["리포트"], "a.pdf"));
    expect((await json("/reports", { method: "POST", body: fd })).status).toBe(415);
    const ok = new FormData();
    ok.append("file", new File(["총보수는 0.07%로 평균 0.25%보다 낮다. 환율 하락 위험이 있다. 따라서 장기 보유를 기대한다."], "메모.txt"));
    const r = await json("/reports", { method: "POST", body: ok });
    expect(r.status).toBe(201);
    expect(r.body.title).toBe("메모");
    expect(r.body.evaluation.total).toBeGreaterThan(0);
  });
  it("제안 적용 후 다시 평가하면 점수 기록이 남는다", async () => {
    const list = (await json("/reports")).body as any[];
    const target = list.find((x) => x.title === "S&P500 ETF 장기 투자 분석");
    const r = await json(`/reports/${target.id}/rescore`, { method: "POST", body: JSON.stringify({ applyFinding: 0 }), headers: { "content-type": "application/json" } });
    expect(r.body.history.length).toBe(2);
    expect(r.body.evaluation.total).toBeGreaterThan(target.evaluation.total);
  });
  it("검색은 종목·학습·용어를 함께 찾는다", async () => {
    const r = await json(`/search?q=${encodeURIComponent("S&P500")}`);
    expect(r.body.instruments.some((i: any) => i.code === "SNP500")).toBe(true);
  });
  it("잘못된 입력은 4xx", async () => {
    expect((await json("/market/NOPE/series")).status).toBe(404);
    expect((await json("/market/KOSPI/series?range=9y")).status).toBe(400);
    expect((await json("/ask", { method: "POST", body: "{}", headers: { "content-type": "application/json" } })).status).toBe(400);
  });
});
