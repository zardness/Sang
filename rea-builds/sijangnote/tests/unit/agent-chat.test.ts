// 챗봇 Agent 답변(INF-017)과 단일 HTML 묶음 슬림 테스트. 실제 결과 폴더 대신 임시 폴더를 씁니다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentAnswer, agentIntent } from "../../server/agent-chat";
import { dartAnswer } from "../../server/dart-chat";
import { Dart } from "../../server/dart";
import { agentBundleInfo, parseReport, segmentsFromClaims } from "../../server/agents";
import { expandShared, slimPersonas, slimResult } from "../../standalone/agent-bundle";

const RUN = "20261106T080850635649Z";
const claim = (seg: string, eok: string, extra: object = {}) => ({ claimId: `C-${seg}`, resultType: "reported_fact", axis: "reported_segment", businessId: `024110_reported_segment_${seg}`, businessUid: `024110:SEG:${seg}`, horizon: "2026Q2 (3개월)", revenueItem: "이자수익", text: `기업은행 ${seg}의 2026Q2 이자수익은 ${eok}억원이다.`, ...extra });
const p02 = {
  reportId: "P02-024110", asOf: "2026-11-06", dataMode: "LIVE", codeVersion: "p02-agent-5.1", publication_eligible: false,
  publicationBlockers: ["사람 검수 전", "차단 보류 1건"], claims: [claim("기업고객", "33,561"), claim("IB", "4,306"), { claimId: "C-MAP", text: "지도 문장", axis: "" }],
  suppressedClaims: [{ claimId: "C-etc", axis: "reported_segment", period: "2026Q2", businessKey: "기타", reason: "NEGATIVE_REVENUE" }], evidence: [{ a: 1 }, { a: 2 }],
  calculations: [{ calculationId: "CAL-etc", unit: "KRW", result: -1387000000000, method: "reported" }, { calculationId: "CAL-x", unit: "KRW", result: 1 }],
  holdRegistry: [{ blocking: true, code: "NEGATIVE_REVENUE" }, { blocking: false }], verifierSummary: { 통과: 3 },
  criticalHolds: [{ problem: "NEGATIVE_REVENUE", limit: "조정 항목이 아닌 매출이 음수", resolve: "기간 검토", count: 1, blocking: true }],
};
const report = (who: string) => `# 기업은행 — ${who}\n\n- 보고서: X\n\n<!-- LOCKED:CRITICAL:BEGIN -->\n## 꼭 알아야 할 보류\n<!-- LOCKED:CRITICAL:END -->\n<!-- SUMMARY:BEGIN -->\n## 요약\n- ${who} 요약\n<!-- SUMMARY:END -->\n<details>\n<!-- LOCKED:HOLDS:BEGIN -->\n## 모든 보류\n- 값 $& 그대로\n<!-- LOCKED:HOLDS:END -->\n<!-- LOCKED:FACTS:BEGIN -->\n## 확인된 주장\n### C-1\n- 유형: reported_fact / 상태: ok\n주장 문장\n<!-- LOCKED:FACTS:END -->\n<!-- LOCKED:EVIDENCE:BEGIN -->\n## 주장별 근거·산식 상세\n긴 근거\n<!-- LOCKED:EVIDENCE:END -->\n</details>\n## 검증·재현 상세\n긴 상세\n`;

describe("[추론 INF-017] 챗봇 Agent 답변", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "p02-"));
    const t = join(dir, "p02_out", RUN, "024110");
    mkdirSync(join(t, "persona_reports"), { recursive: true });
    writeFileSync(join(t, "result.json"), JSON.stringify(p02));
    process.env.P02_DIR = dir;
  });
  afterEach(() => {
    delete process.env.P02_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("은행은 이자수익으로 답하고 매출이라고 부르지 않으며 출처·검증 전을 붙인다", () => {
    const a = agentAnswer("기업은행 부문별 이자수익 알려줘")!;
    expect(a.inferred).toBe("INF-017");
    expect(a.answer.split("\n")[0]).toBe("기업은행 부문별 이자수익(2026Q2, P02 결과 · 검증 전)입니다.");
    expect(a.answer).toContain("기업고객: 33,561억원");
    expect(a.answer).toContain("기타 부문은 차단 보류로 숫자를 숨겼습니다.");
    expect(a.answer).toContain(`P02 · p02_out/${RUN}`);
    expect(a.answer).toContain("**검증 전**");
    expect(a.answer.replace(/'매출'로 보면 안 됩니다/, "")).not.toContain("매출");
  });
  it("보류 질문은 Agent 원문 사유를 보여 주되 은행에는 공시 항목 이름을 쓴다", () => {
    const a = agentAnswer("기업은행 P02 보류 이유는?")!;
    expect(a.answer.split("\n")[0]).toContain("보류는 2건이고 그중 차단 보류가 1건");
    expect(a.answer).toContain("조정 항목이 아닌 이자수익이 음수");
    expect(a.answer).not.toContain("매출");
    expect(a.answer).toContain("보류 이유: 사람 검수 전 / 차단 보류 1건");
  });
  it("의도 판별: 사업 이름·재무·공시 질문은 맡지 않는다", () => {
    expect(agentIntent("기업은행 P02 보류 이유는?")).toMatchObject({ want: "holds", agents: ["p02"] });
    expect(agentIntent("기업은행 사업부 이자수익")).toMatchObject({ want: "segments" });
    expect(agentIntent("기업은행 영업이익 얼마야?")).toBeNull();
    expect(agentIntent("기업은행 최근 공시")).toBeNull();
    expect(agentIntent("ETF 총보수가 뭐야")).toBeNull();
  });
  it("키가 없을 때 Agent 기업도 공시·영업이익은 서버 필요 안내, 매출은 P02 표로 답한다", async () => {
    const d = new Dart({ key: undefined });
    expect((await dartAnswer("기업은행 최근 공시 알려줘", d))!.answer).toContain("서버 없이 여는 단일 HTML");
    expect((await dartAnswer("기업은행 영업이익 얼마야", d))!.answer).toContain("dart.config.json");
    const sales = (await dartAnswer("기업은행 매출 얼마야", d))!;
    expect(sales.inferred).toBe("INF-017");
    expect(sales.answer.split("\n")[0]).toContain("부문별 이자수익");
  });
  it("묶음 정보는 manifest.json 이 있을 때만 나온다", () => {
    expect(agentBundleInfo()).toBeNull();
    const root = mkdtempSync(join(tmpdir(), "bundle-"));
    mkdirSync(join(root, "p02"));
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ note: "기업은행" }));
    process.env.P02_DIR = join(root, "p02");
    expect(agentBundleInfo()).toEqual({ note: "기업은행" });
    process.env.P02_DIR = dir;
    rmSync(root, { recursive: true, force: true });
  });
});

describe("단일 HTML 묶음 슬림", () => {
  it("result.json 슬림 후에도 사업부 표·개수에 쓰는 값이 같다", () => {
    const s = slimResult("p02", p02) as typeof p02;
    expect(segmentsFromClaims(s.claims, s.suppressedClaims, s.calculations)).toEqual(segmentsFromClaims(p02.claims, p02.suppressedClaims, p02.calculations));
    expect([s.claims.length, s.evidence.length, s.calculations.length, s.holdRegistry.length]).toEqual([3, 2, 2, 2]);
    expect(JSON.stringify(s)).not.toContain("지도 문장");
    const p04 = slimResult("p04", { claims: [{ claimId: "P04_OBS_TREND", text: "현재 하락추세이며", evidence: "x" }, { claimId: "P04_OBS_RSI", text: "RSI" }], suppressedClaims: [{ claimId: "P04_RV5.prob", reason: "EVALUATION_BLOCKED", extra: 1 }] }) as { claims: unknown[]; suppressedClaims: unknown[] };
    expect(p04.claims).toEqual([{ claimId: "P04_OBS_TREND", text: "현재 하락추세이며" }, 0]);
    expect(p04.suppressedClaims).toEqual([{ claimId: "P04_RV5.prob", reason: "EVALUATION_BLOCKED" }]);
  });
  it("보고서 슬림: 근거 상세를 빼고 공유 구역을 복원하면 화면 파싱 결과가 같다 ($ 글자 포함)", () => {
    const files = ["L1", "L2"].map((w) => ({ name: `report_${w}_neutral.md`, md: report(w) }));
    const slim = slimPersonas(files);
    expect(slim.files[0].md).not.toContain("긴 근거");
    expect(slim.files[0].md).not.toContain("긴 상세");
    expect(slim.files[0].md).not.toContain("주장 문장");
    expect(Object.keys(slim.shared).sort()).toEqual(["LOCKED:CRITICAL", "LOCKED:FACTS", "LOCKED:HOLDS"]);
    files.forEach((f, i) => expect(parseReport(expandShared(slim.files[i].md, slim.shared))).toEqual(parseReport(f.md)));
    expect(expandShared(slim.files[0].md, slim.shared)).toContain("값 $& 그대로");
  });
});
