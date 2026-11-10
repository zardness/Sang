// E2E: 화면 분석 단계의 핵심 시나리오와 기업 분석(Agent 연동)을 실제 브라우저로 돌립니다.
// 전용 포트(웹 4417 / API 4418)와 임시 DB를 써서 개발 중인 서버와 겹치지 않습니다.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startFakeDart } from "./fake-dart.mjs";

const WEB = 4417, API = 4418;
const dir = mkdtempSync(join(tmpdir(), "sijang-e2e-"));
const DART = 4419;
const env = { ...process.env, API_PORT: String(API), WEB_PORT: String(WEB), SIJANG_DB: join(dir, "e2e.db"), VITE_SHOW_INFERENCE: "1", DART_API_KEY: "E2E_FAKE_KEY", DART_BASE: `http://127.0.0.1:${DART}/api`, DART_CACHE: join(dir, "dart-cache") };
// Windows 에서는 npx 가 .cmd 라 셸로 띄우고, 끌 때는 자식까지 taskkill 로 끈다
const WIN = process.platform === "win32";
const SPAWN = WIN ? { stdio: "ignore", shell: true, windowsHide: true } : { stdio: "ignore", detached: true };
let fakeDart;
let procs = [];
const base = `http://127.0.0.1:${WEB}`;

async function portFree(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    return false;
  } catch {
    return true;
  }
}

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버가 뜨지 않았습니다");
}

const results = [];
async function scenario(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}\n  ${e.message}`);
  }
}

let browser;
try {
  if (!(await portFree(WEB)) || !(await portFree(API))) throw new Error(`포트 ${WEB}/${API} 가 이미 쓰이고 있습니다. 이전 테스트 프로세스를 종료하세요.`);
  fakeDart = await startFakeDart(DART);
  procs = [
  spawn("npx", ["tsx", "server/index.ts"], { env, ...SPAWN }),
  spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(WEB), "--strictPort"], { env, ...SPAWN }),
];
  await waitUp();
  const launch = {};
  if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
  browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await scenario("S1 랜딩: 시장 카드 값과 검색 → ETF 상세 이동", async () => {
    await page.goto(base + "/");
    await page.getByText("2,742.18").first().waitFor();
    const box = page.locator(".big-search input");
    await box.fill("S&P500");
    await page.locator(".big-search .dropdown a", { hasText: "미국 S&P500 지수 ETF" }).click();
    await page.waitForURL("**/app/etf/SNP500");
    await page.getByRole("heading", { name: "미국 S&P500 지수 ETF" }).waitFor();
  });

  await scenario("S2 대시보드: 헤드라인 규칙, 기간 전환, 지수 전환, 툴팁", async () => {
    await page.goto(base + "/app/dashboard");
    await page.getByText("오늘은 대형주가 시장을 끌어올렸어요").waitFor();
    await page.getByRole("button", { name: "5년" }).click();
    const chart = page.locator(".chart").first();
    const bb = await chart.boundingBox();
    await page.mouse.move(bb.x + bb.width * 0.5, bb.y + 100);
    await page.locator(".chart .tip").waitFor();
    await page.locator(".kpi", { hasText: "나스닥" }).click();
    await page.getByText("21,408.11").first().waitFor();
  });

  await scenario("S3 ETF 상세: 예측 밴드, Agent 분석, 관심 종목, 리포트 만들기", async () => {
    await page.goto(base + "/app/etf/SNP500");
    const aiBtn = page.getByRole("button", { name: /AI 패널 열기/ });
    if (await aiBtn.count()) await aiBtn.click();
    await page.getByText("6개월 예측").first().waitFor();
    await page.getByText(/5년 동안 꾸준히 올랐고/).waitFor();
    for (const v of ["낮음", "높음", "중간"]) await page.locator(".tile b", { hasText: v }).first().waitFor();
    await page.getByRole("button", { name: "관심 종목에 추가" }).click();
    await page.locator(".watch-row", { hasText: "미국 S&P500 지수 ETF" }).waitFor();
    await page.getByRole("tab", { name: "구성 종목" }).click();
    await page.getByText("가상 테크 A").waitFor();
    await page.getByRole("button", { name: "최종 정리 리포트 만들기" }).click();
    await page.waitForURL(/\/app\/reports\?id=\d+/);
    await page.locator(".r-item.sel", { hasText: "정리 리포트" }).waitFor();
  });

  await scenario("S4 학습: 용어 풀이 전환, 계산기, 다 읽음 → 진행률 4/7", async () => {
    await page.goto(base + "/app/learn/etf-101-3");
    await page.getByRole("heading", { name: "같은 지수인데 수익이 다른 이유" }).waitFor();
    await page.locator(".calc", { hasText: "33만원" }).waitFor();
    await page.getByRole("button", { name: "추적 오차" }).click();
    await page.locator(".term-card h3", { hasText: "추적 오차" }).waitFor();
    await page.getByRole("button", { name: "다 읽었어요" }).click();
    await page.getByText("ETF 입문 4/7").waitFor();
  });

  await scenario("S5 보고서 평가: 업로드 → 채점 → 제안 적용 → 점수 상승", async () => {
    await page.goto(base + "/app/reports");
    // 한글 경로 파일은 Playwright가 못 읽는 경우가 있어 버퍼로 넘깁니다 (파일 이름은 한글 그대로)
    await page.locator('input[type="file"]').setInputFiles({
      name: "내 메모.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("미국 지수 ETF를 샀다. 총보수는 0.07%로 낮다. 장기로 보면 위험은 크지 않다. 따라서 10년 보유를 기대한다."),
    });
    const item = page.locator(".r-item.sel", { hasText: "내 메모" });
    await item.waitFor();
    const before = Number(await item.locator(".s").textContent());
    await page.getByText("꼭 수정").first().waitFor();
    await page.getByRole("button", { name: "제안 적용" }).click();
    await page.getByText("점수 변화").waitFor();
    const after = Number(await page.locator(".r-item.sel .s").textContent());
    assert.ok(after > before, `점수가 올라야 함: ${before} → ${after}`);
  });

  await scenario("S6 AI 질문: 답변, 단계 표시, 근거 패널 유사도", async () => {
    await page.goto(base + "/app/ask");
    await page.getByLabel("질문").fill("장기 투자용으로 국내 ETF랑 해외 ETF 중에 뭘 먼저 공부하면 좋아?");
    await page.getByRole("button", { name: "보내기" }).click();
    await page.locator(".a-card .text b", { hasText: "국내 지수 ETF" }).first().waitFor();
    await page.locator(".step", { hasText: "참고서 검색" }).first().waitFor();
    const score = await page.locator(".src-card .h span").first().textContent();
    assert.match(score ?? "", /^0\.\d\d$/);
  });

  await scenario("S9 기업 분석: 검색 → P02 사업표·질의 → P04 관측·보류 → 페르소나 보고서", async () => {
    await page.goto(base + "/app/dashboard");
    await page.locator(".top-search input").fill("삼성전자");
    await page.locator(".top-search .dropdown a", { hasText: "삼성전자" }).click();
    await page.waitForURL("**/app/company/005930");
    await page.getByText("검증 전 결과").waitFor();
    await page.locator(".co-seg td", { hasText: "1,275,161" }).waitFor();
    await page.getByLabel("사업 이름").fill("HBM");
    await page.getByRole("button", { name: "찾기" }).click();
    await page.getByText("TARGET_NOT_DISCLOSED").waitFor();
    await page.getByRole("tab", { name: "기술적 분석 (P04)" }).click();
    await page.locator(".co-obs .o", { hasText: "RSI(14)" }).getByText("42.1").waitFor();
    assert.equal(await page.locator(".co-fc .f", { hasText: "보류" }).count(), 4);
    await page.getByRole("tab", { name: "Agent 보고서" }).click();
    await page.getByRole("heading", { name: /기술적 분석 L2 초급 설명/ }).waitFor();
    await page.getByText("H-005930-a5e6b39e").waitFor();
    await page.getByRole("button", { name: "사업 분석 P02" }).click();
    await page.getByText(/보고서가 없어/).waitFor();
    await page.getByRole("heading", { name: /L1 입문 설명/ }).waitFor();
  });

  await scenario("S10 AI 질문: 기업 Agent 주장으로 답한다", async () => {
    await page.goto(base + "/app/ask");
    await page.getByLabel("질문").fill("SK하이닉스 최대낙폭은?");
    await page.getByRole("button", { name: "보내기" }).click();
    await page.getByText("SK하이닉스 최근 1년 최대낙폭은 -58.1%였습니다.").first().waitFor();
    await page.locator(".src-card", { hasText: "SK하이닉스 기술적 분석(P04)" }).first().waitFor();
  });

  await scenario("S11 AI 챗봇 위젯: 어느 화면에서나 열고 Agent 근거로 답한다", async () => {
    await page.goto(base + "/app/company/005930");
    await page.getByRole("button", { name: "AI 챗봇 열기" }).click();
    await page.getByLabel("챗봇 질문").fill("삼성전자 HBM 매출은 얼마야?");
    await page.getByRole("button", { name: "챗봇에 보내기" }).click();
    await page.locator(".cw-a", { hasText: "TARGET_NOT_DISCLOSED" }).waitFor();
    await page.locator(".cw-steps span", { hasText: "사업 질의(P02)" }).first().waitFor();
    await page.getByLabel("챗봇 질문").fill("SK하이닉스 최대낙폭은?");
    await page.getByRole("button", { name: "챗봇에 보내기" }).click();
    await page.locator(".cw-a", { hasText: "-58.1%" }).waitFor();
    await page.getByRole("button", { name: "AI 챗봇 닫기" }).click();
  });

  await scenario("S12 OpenDART 50개 기업: 목록·피드 → 현대차 공시·재무 → 챗봇 공시 답변", async () => {
    await page.goto(base + "/app/company");
    await page.locator(".co-mini").first().waitFor();
    assert.equal(await page.locator(".co-mini").count() + (await page.locator(".co-pick").count()), 50);
    await page.locator(".dart-feed", { hasText: "현금ㆍ현물배당결정" }).waitFor();
    await page.getByLabel("기업 찾기").fill("현대차");
    assert.equal(await page.locator(".co-mini").count(), 1);
    await page.locator(".co-mini", { hasText: "현대차" }).click();
    await page.getByRole("heading", { name: "현대차", level: 1 }).waitFor();
    await page.locator(".dart-list", { hasText: "분기보고서 (2026.09)" }).waitFor();
    await page.getByText("2026년 반기보고서").waitFor();
    await page.getByText("2025년 사업보고서").waitFor();
    await page.locator(".dart-ov", { hasText: "현대자동차(주)" }).waitFor();
    const href = await page.locator(".dart-list a", { hasText: "분기보고서 (2026.09)" }).getAttribute("href");
    assert.equal(href, "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261104000333");
    await page.getByRole("button", { name: "AI 챗봇 열기" }).click();
    await page.getByLabel("챗봇 질문").fill("현대차 최근 공시 알려줘");
    await page.getByRole("button", { name: "챗봇에 보내기" }).click();
    await page.locator(".cw-a", { hasText: "분기보고서 (2026.09)" }).waitFor();
    await page.locator(".cw-steps span", { hasText: "OpenDART 공시 검색" }).first().waitFor();
    await page.getByLabel("챗봇 질문").fill("현대차 영업이익 얼마야?");
    await page.getByRole("button", { name: "챗봇에 보내기" }).click();
    await page.locator(".cw-a", { hasText: "700,000억원" }).waitFor();
    await page.getByRole("button", { name: "AI 챗봇 닫기" }).click();
    await page.goto(base + "/app/company/005930?tab=dart");
    await page.locator(".dart-list", { hasText: "분기보고서 (2026.09)" }).waitFor();
  });

  await scenario("S7 모바일 폭(390px): 가로 스크롤 없음", async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await m.newPage();
    for (const path of ["/", "/app/dashboard", "/app/etf/SNP500", "/app/learn/etf-101-3", "/app/reports", "/app/ask", "/app/company", "/app/company/005930", "/app/company/000660?tab=technical", "/app/company/005930?tab=report", "/app/company/005380", "/app/company/005930?tab=dart"]) {
      await p.goto(base + path);
      await p.waitForTimeout(400);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${path} 가로 넘침 ${overflow}px`);
    }
    await m.close();
  });

  await scenario("S8 런타임 오류 없음", async () => {
    assert.deepEqual(errors, []);
  });
} finally {
  await browser?.close();
  fakeDart?.close();
  // npx 아래 자식 프로세스까지 함께 종료 (프로세스 그룹)
  procs.forEach((p) => {
    try {
      if (WIN) spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-p.pid, "SIGTERM");
    } catch {}
  });
  rmSync(dir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
