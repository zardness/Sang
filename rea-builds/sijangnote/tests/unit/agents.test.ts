// P02·P04 Agent 결과 연동 테스트: 노트북 스냅샷과 PC 결과 폴더 읽기
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentCompanies, agentsFor, businessQuery, latestRun, loadReport, loadSummary, parseCsv, parseReport, personaId, segmentsFromClaims } from "../../server/agents";

describe("노트북 스냅샷", () => {
  it("P02 삼성전자: 주장·보류 수와 2026Q2 DS 부문 매출이 노트북 출력과 같다", () => {
    const s = loadSummary("p02", "005930")!;
    expect(s.source.kind).toBe("snapshot");
    expect(s.counts).toMatchObject({ claims: 194, suppressed: 89, holds: 51, blocking: 24 });
    if (!("segments" in s)) throw new Error("P02 아님");
    const seg = s.segments.reported_segment;
    const ds = seg.rows.find((r) => r.name === "DS 부문")!;
    expect(seg.periods.at(-1)).toBe("2026Q2");
    expect(ds.values.at(-1)).toBe(1275161);
    expect(s.criticalHolds.map((c) => [c.count, c.blocking])).toEqual([[18, true], [6, true]]);
    expect(s.dataMode).toBe("LIVE");
  });

  it("P04 SK하이닉스: 관측 지표 17개, 예측 4개 모두 보류", () => {
    const s = loadSummary("p04", "000660")!;
    if (!("observations" in s)) throw new Error("P04 아님");
    expect(s.observations).toHaveLength(17);
    expect(s.observations.find((o) => o.id === "OBS_CLOSE")?.value).toBe(1398000);
    expect(s.observations.find((o) => o.id === "OBS_MDD_1Y")?.value).toBe(-58.1);
    expect(s.forecasts.every((f) => f.status === "held" && f.holds.includes("CALENDAR_UNVERIFIED"))).toBe(true);
    expect(s.status).toBe("observation_only");
  });

  it("페르소나 보고서: 요약·꼭 알아야 할 보류·보류 등록부·주장을 구역별로 나눈다", () => {
    const r = loadReport("p04", "005930", "L2", "conservative")!;
    expect(r.substituted).toBe(false);
    expect(r.personaId).toBe("L2-CON");
    expect(r.summary).toContain("최근 1년 최대낙폭은 -42.9%");
    expect(r.critical[0].holdId).toBe("H-005930-a5e6b39e");
    expect(r.holds).toHaveLength(7);
    expect(r.claims.find((c) => c.id === "P04_OBS_RSI")?.text).toBe("RSI(14)는 42.1입니다.");
  });

  it("없는 조합을 요청하면 가까운 보고서로 대신하고 그 사실을 알린다", () => {
    const r = loadReport("p02", "000660", "L4", "aggressive")!;
    expect(r.substituted).toBe(true);
    expect(r.level).toBe("L1");
    expect(r.holds.length).toBe(7);
  });

  it("사업 질의: 공시에 없는 HBM은 상위 사업으로 대신 답하지 않는다 (INF-013)", () => {
    expect(businessQuery("005930", "HBM")).toMatchObject({ found: false, holds: ['TARGET_NOT_DISCLOSED: 삼성전자 "HBM" 매출이 공시 사업 단위에 없음'] });
    const ds = businessQuery("005930", "DS")!;
    expect(ds.found).toBe(true);
    expect(ds.matches[0]).toMatchObject({ name: "DS 부문", period: "2026Q2", eok: 1275161 });
  });
});

describe("PC 결과 폴더 읽기", () => {
  let dir = "";
  afterEach(() => {
    delete process.env.P02_DIR;
    delete process.env.P04_DIR;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("가장 최근 실행 폴더의 result.json·CSV·보고서를 읽는다", () => {
    dir = mkdtempSync(join(tmpdir(), "p02-"));
    for (const run of ["20261103T052238456867Z", "20261104T085311928947Z"]) {
      const t = join(dir, "p02_out", run, "005930");
      mkdirSync(join(t, "persona_reports"), { recursive: true });
      const claims = [
        { claimId: "C-Q1", resultType: "reported_fact", axis: "reported_segment", businessId: "005930_reported_segment_DS 부문", businessUid: "005930:SEG:DS", horizon: "2026Q2 (3개월)", text: `삼성전자 DS 부문의 2026Q2 매출은 ${run.startsWith("20261104") ? "1,275,161" : "1"}억원이다.` },
        { claimId: "C-Q2", resultType: "derived_calculation", axis: "reported_segment", businessId: "005930_reported_segment_DS 부문", businessUid: "005930:SEG:DS", horizon: "2025Q4 (3개월)", text: "삼성전자 DS 부문의 2025Q4 매출은 440,053억원이다." },
        { claimId: "C-G1", resultType: "derived_calculation", axis: "reported_segment", businessId: "005930_reported_segment_DS 부문", horizon: "2026Q2", text: "삼성전자 DS 부문의 2026Q2 매출은 전년 동기 대비 +357.46% 변했다." },
      ];
      writeFileSync(join(t, "result.json"), JSON.stringify({ reportId: "P02-005930-2026-11-04", asOf: "2026-11-04", dataMode: "LIVE", codeVersion: "p02-agent-5.1", publication_eligible: false, claims, suppressedClaims: [{}], evidence: [{}, {}], calculations: [{}], holdRegistry: [{ blocking: true }, { blocking: false }], verifierSummary: { "V1 근거 연결": { 통과: 3 } }, criticalHolds: [{ problem: "문제", limit: "제한", resolve: "해결", count: 2, blocking: true }] }));
      writeFileSync(join(t, "company_revenue.csv"), "﻿fiscal_year,quarter,period,api_revenue_won,api_method,api_rcept_no\n2026,Q2,2026Q2,171499470000000,\"반기 3개월\",20260814003699\n");
      writeFileSync(join(t, "persona_reports", "report_L3_aggressive.md"), "# 삼성전자(005930) — L3\n\n- 보고서: X / 분석 기준일: 2026-11-04 / 자료 모드: LIVE\n\n<!-- SUMMARY:BEGIN -->\n## 요약\n- 요약 문장\n<!-- SUMMARY:END -->\n");
    }
    process.env.P02_DIR = dir;
    expect(latestRun("p02", "005930")).toMatchObject({ kind: "pc", run: "p02_out/20261104T085311928947Z" });
    const s = loadSummary("p02", "005930")!;
    if (!("segments" in s)) throw new Error("P02 아님");
    expect(s.source.label).toBe("PC 결과 파일");
    expect(s.counts).toMatchObject({ claims: 3, suppressed: 1, evidence: 2, holds: 2, blocking: 1 });
    expect(s.verifier).toEqual([{ check: "V1 근거 연결", pass: 3, fail: 0 }]);
    expect(s.segments.reported_segment).toEqual({ periods: ["2025Q4", "2026Q2"], rows: [{ name: "DS 부문", values: [440053, 1275161], q4Derived: [true, false] }] });
    expect(s.companyRevenue[0]).toMatchObject({ period: "2026Q2", won: 171499470000000, method: "반기 3개월" });
    expect(s.personas.map((p) => p.key)).toEqual(["L3_aggressive"]);
    const r = loadReport("p02", "005930", "L3", "aggressive")!;
    expect(r.substituted).toBe(false);
    expect(r.summary).toBe("- 요약 문장");
    // 다른 종목은 PC 폴더에 없으면 스냅샷으로
    expect(latestRun("p02", "000660").kind).toBe("snapshot");
  });

  it("Agent를 새 종목으로 돌리면 그 종목에 Agent 탭이 자동으로 붙는다", () => {
    dir = mkdtempSync(join(tmpdir(), "p04-"));
    const t = join(dir, "p04_out", "20261105T010000000000Z", "005380");
    mkdirSync(t, { recursive: true });
    writeFileSync(join(t, "result.json"), JSON.stringify({ reportId: "P04-005380", asOf: "2026-11-04", dataMode: "LIVE", publication_eligible: false, claims: [{ claimId: "P04_OBS_RSI", text: "RSI(14)는 50입니다." }] }));
    expect(agentsFor("005380")).toEqual({ p02: false, p04: false });
    process.env.P04_DIR = dir;
    expect(agentsFor("005380")).toEqual({ p02: false, p04: true });
    expect(agentCompanies().map((c) => c.ticker)).toEqual(["005930", "000660", "005380"]);
    expect(loadSummary("p02", "005380")).toBeNull();
    expect(loadSummary("p04", "005380")?.name).toBe("현대차");
  });

  it("작은 도구들", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([{ a: "x, y", b: 'say "hi"' }]);
    expect(personaId("L4", "aggressive")).toBe("L4-AGG");
    expect(segmentsFromClaims([])).toEqual({});
    expect(parseReport("# 제목\n").title).toBe("제목");
  });
});

describe("Verifier 합계 형식", () => {
  it("{통과: n} 처럼 검사 이름 없는 합계도 읽는다", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const d = mkdtempSync(join(tmpdir(), "p02v-"));
    const t = join(d, "p02_out", "20261105T024945117937Z", "105560");
    mkdirSync(t, { recursive: true });
    writeFileSync(join(t, "result.json"), JSON.stringify({ reportId: "x", asOf: "2026-11-05", publication_eligible: false, claims: [{ claimId: "C1", text: "x" }], holdRegistry: [{ blocking: true }], verifierSummary: { 통과: 265, 실패: 0 } }));
    process.env.P02_DIR = d;
    try {
      const s = loadSummary("p02", "105560")!;
      expect(s.verifier).toEqual([{ check: "전체 검사", pass: 265, fail: 0 }]);
      expect(s.counts.blocking).toBe(1);
    } finally {
      delete process.env.P02_DIR;
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("빈 최신 실행 건너뛰기", () => {
  it("가장 최근 실행이 주장 0개면 그 앞의 실행을 읽는다", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const d = mkdtempSync(join(tmpdir(), "p02e-"));
    const put = (run: string, n: number) => {
      const t = join(d, "p02_out", run, "207940");
      mkdirSync(t, { recursive: true });
      writeFileSync(join(t, "result.json"), JSON.stringify({ reportId: run, claims: Array.from({ length: n }, (_, i) => ({ claimId: `C${i}`, text: "x" })) }));
    };
    put("20261105T024945117937Z", 52);
    put("20261105T041145942661Z", 0);
    process.env.P02_DIR = d;
    try {
      expect(latestRun("p02", "207940").run).toBe("p02_out/20261105T024945117937Z");
      const { agentsFor } = await import("../../server/agents");
      expect(agentsFor("207940").p02).toBe(true);
      // 모든 실행이 빈 결과인 종목은 Agent 탭을 붙이지 않는다
      const e = join(d, "p02_out", "20261105T041145942661Z", "024110");
      mkdirSync(e, { recursive: true });
      writeFileSync(join(e, "result.json"), JSON.stringify({ claims: [] }));
      expect(agentsFor("024110").p02).toBe(false);
      put("20261106T010000000000Z", 40);
      expect(latestRun("p02", "207940").run).toBe("p02_out/20261106T010000000000Z");
    } finally {
      delete process.env.P02_DIR;
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("PC 결과 파일의 예외 형식", () => {
  it("NaN 이 들어 있는 result.json 도 읽고, claims 키가 없는 미완료 결과는 결과 없음으로 본다", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { parseLooseJson, agentsFor } = await import("../../server/agents");
    expect(parseLooseJson<{ a: null; s: string; b: number[] }>('{"a": NaN, "s": "NaN 그대로", "b": [1, -Infinity]}')).toEqual({ a: null, s: "NaN 그대로", b: [1, null] });
    const d = mkdtempSync(join(tmpdir(), "p02n-"));
    const put = (run: string, t: string, body: string) => {
      mkdirSync(join(d, "p02_out", run, t), { recursive: true });
      writeFileSync(join(d, "p02_out", run, t, "result.json"), body);
    };
    put("20261105T024945117937Z", "138040", JSON.stringify({ asOf: "2026-11-05", claims: [{ claimId: "A", text: "x" }] }));
    put("20261106T054315077021Z", "138040", '{"asOf": "2026-11-06", "claims": [{"claimId": "B", "text": "y"}], "q4Check": [{"api_q4_won": NaN}]}');
    put("20261106T022052419141Z", "042660", JSON.stringify({ status: "incomplete" }));
    process.env.P02_DIR = d;
    try {
      expect(loadSummary("p02", "138040")?.asOf).toBe("2026-11-06");
      expect(agentsFor("042660").p02).toBe(false);
    } finally {
      delete process.env.P02_DIR;
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("매출이 아닌 항목·숨김 주장·차단 보류 묶기", () => {
  const put = (result: unknown) => {
    const d = mkdtempSync(join(tmpdir(), "p02r-"));
    const t = join(d, "p02_out", "20261106T065744409238Z", "024110");
    mkdirSync(t, { recursive: true });
    writeFileSync(join(t, "result.json"), JSON.stringify(result));
    process.env.P02_DIR = d;
    return d;
  };
  const claim = (id: string, key: string, label: string, eok: string) => ({ claimId: id, resultType: "reported_fact", axis: "reported_segment", businessId: `024110_reported_segment_${key}`, businessUid: `024110:SEG:${key}`, horizon: "2026Q2 (3개월)", revenueItem: "이자수익", text: `기업은행 ${label}의 2026Q2 이자수익은 ${eok}억원이다.` });
  const base = {
    reportId: "x",
    asOf: "2026-11-06",
    publication_eligible: false,
    claims: [claim("C-Q1", "자금시장", "자금시장", "100"), claim("C-Q2", "연결총계", "연결 이자수익 합계", "60"), claim("C-Q3", "내부거래조정등", "내부거래 조정 등", "-10")],
    suppressedClaims: [
      { claimId: "C-Q9", reason: "NEGATIVE_REVENUE: 원문 값이 음수라 단독 주장으로 내지 않음(합계 검증에는 포함)", axis: "reported_segment", period: "2026Q2", businessKey: "기타" },
      { claimId: "C-Q8", reason: "해당 사업 범위의 합계 검증 미통과 또는 미확인", axis: "reported_segment", period: "2026Q2", businessKey: "미통과" },
      { claimId: "C-MAP1", reason: "사업 지도 근거 검토 필요" },
    ],
    calculations: [{ calculationId: "CAL-Q9", method: "derived", unit: "KRW", result: -3000000000 }, { calculationId: "CAL-Q8", method: "derived", unit: "KRW", result: 500000000 }],
    holdRegistry: [
      { code: "NEGATIVE_REVENUE", cause: "조정 항목이 아닌 매출이 음수", needed: "기간·부호·정정 여부 검토", blocking: true },
      { code: "NEGATIVE_REVENUE", cause: "조정 항목이 아닌 매출이 음수", needed: "기간·부호·정정 여부 검토", blocking: "True" },
      { code: "GROWTH_NOT_COMPARABLE", cause: "전년 값이 없거나 0 이하", detail: "금액만 사용", blocking: true },
      { code: "EVIDENCE_NOT_FOUND", cause: "근거 없음", blocking: false },
    ],
  };
  afterEach(() => { delete process.env.P02_DIR; });

  it("revenueItem: 첫 비어 있지 않은 값을 쓰고 없으면 매출", () => {
    const d = put({ ...base, claims: [{ claimId: "C0", text: "x", revenueItem: "" }, ...base.claims] });
    try {
      const s = loadSummary("p02", "024110")!;
      if (!("revenueItem" in s)) throw new Error("P02 아님");
      expect(s.revenueItem).toBe("이자수익");
    } finally { rmSync(d, { recursive: true, force: true }); }
    const e = put({ ...base, claims: [{ claimId: "C0", text: "x" }] });
    try {
      const s = loadSummary("p02", "024110")!;
      if (!("revenueItem" in s)) throw new Error("P02 아님");
      expect(s.revenueItem).toBe("매출");
    } finally { rmSync(e, { recursive: true, force: true }); }
  });

  it("합계 검증에 쓰인 숨김 주장만 hidden 행으로 넣고, 합계가 맞으며, 합계 미통과 숫자는 넣지 않는다", () => {
    const seg = segmentsFromClaims(base.claims, base.suppressedClaims, base.calculations).reported_segment;
    expect(seg.rows.map((r) => r.name)).toEqual(["자금시장", "기타", "[조정] 내부거래 조정 등", "[연결] 연결 합계"]);
    expect(seg.rows[1]).toMatchObject({ name: "기타", values: [-30], hidden: true, hiddenAt: [true] });
    expect(seg.rows[0].hidden).toBeUndefined();
    const v = Object.fromEntries(seg.rows.map((r) => [r.name, r.values[0]!]));
    expect(v["자금시장"] + v["기타"] + v["[조정] 내부거래 조정 등"]).toBe(v["[연결] 연결 합계"]);
    expect(segmentsFromClaims(base.claims, [{ ...base.suppressedClaims[0], claimId: "C-Q7" }], base.calculations).reported_segment.rows.some((r) => r.hidden)).toBe(false);
    // 금융지주의 '(연결)조정' 같은 조정 행도 사업 행으로 세지 않는다
    expect(segmentsFromClaims([claim("C-Q4", "(연결)조정", "(연결)조정", "-208")]).reported_segment.rows[0].name).toBe("[조정] (연결)조정");
  });

  it("숨김 행은 사업 질의의 답이 되지 않고 공시 없음으로도 답하지 않는다", () => {
    const d = put(base);
    try {
      expect(businessQuery("024110", "기타")).toMatchObject({ found: false, holds: ['HIDDEN_BY_BLOCKING_HOLD: 기업은행 "기타" 이자수익은 공시에 있으나 차단 보류로 단독 주장에서 빠짐'] });
      expect(businessQuery("024110", "자금시장")?.found).toBe(true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it("criticalHolds 가 비면 차단 보류를 코드별로 묶고, 있으면 그대로 쓴다", () => {
    const d = put({ ...base, criticalHolds: [] });
    try {
      expect(loadSummary("p02", "024110")!.criticalHolds).toEqual([
        { problem: "NEGATIVE_REVENUE", limit: "조정 항목이 아닌 매출이 음수", resolve: "기간·부호·정정 여부 검토", count: 2, blocking: true },
        { problem: "GROWTH_NOT_COMPARABLE", limit: "전년 값이 없거나 0 이하", resolve: "금액만 사용", count: 1, blocking: true },
      ]);
    } finally { rmSync(d, { recursive: true, force: true }); }
    const e = put({ ...base, criticalHolds: [{ problem: "문제", limit: "제한", resolve: "해결", count: 2, blocking: true }] });
    try {
      expect(loadSummary("p02", "024110")!.criticalHolds).toHaveLength(1);
      expect(loadSummary("p02", "024110")!.criticalHolds[0].problem).toBe("문제");
    } finally { rmSync(e, { recursive: true, force: true }); }
  });
});
