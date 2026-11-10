// 단일 HTML 검증: 서버 없이 file:// 로 열어 50개 Agent 결과와 챗봇 답을 실제 브라우저에서 확인합니다.
//   npm run test:html   (먼저 npm run agent:bundle && npm run build:html)
// 스크린샷: data/html-final-screens/ , 답변 기록: data/html-final-screens/answers.json
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const html = resolve(process.argv[2] ?? "dist-html/sijangnote.html");
const url = pathToFileURL(html).href;
const out = resolve("data/html-final-screens");
mkdirSync(out, { recursive: true });

const results = [];
async function scenario(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✓ ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}\n  ${e.message}`);
  }
}

const launch = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const external = [];
page.on("request", (r) => {
  if (!/^(file|data|blob):/.test(r.url())) external.push(r.url());
});
page.setDefaultTimeout(30000);
const go = async (p, route) => {
  await p.goto(`${url}#${route}`);
  await p.reload();
};

const QA = [
  { q: "기업은행 부문별 이자수익 알려줘", has: ["기업은행", "이자수익", "P02 · p02_out/20261106T080850635649Z", "검증 전", "보류 이유"], notSales: true },
  { q: "KB금융 P02 보류 이유는?", has: ["KB금융", "보류", "P02 · p02_out/", "검증 전", "보류 이유"], notSales: true },
  { q: "삼성전자 P04 기술적 분석 결과는?", has: ["삼성전자 P04 기술적 분석", "국면", "P04 · p04_out/", "검증 전", "보류 이유"] },
  { q: "한화오션 사업부 매출", has: ["한화오션 부문별 매출", "P02 · p02_out/", "검증 전", "보류 이유"] },
];
const answers = [];

try {
  await scenario("① 기업 분석 목록: Agent 50개와 결과 기준 표시", async () => {
    const t = Date.now();
    await go(page, "/app/company");
    await page.locator(".co-pick").first().waitFor();
    console.log(`  목록 표시까지 ${Date.now() - t}ms`);
    assert.equal(await page.locator(".co-pick").count(), 50);
    assert.equal(await page.locator(".co-mini").count(), 0);
    const note = await page.locator(".bundle-note").innerText();
    console.log(`  ${note}`);
    for (const w of ["02_Agent_Final_V1106", "04_Agent_Final_V1106", "실행 폴더 P02 9개", "P04 2개", "묶은 시각", "기업은행(P02)", "실행 사본", "검증 전"]) assert.ok(note.includes(w), `결과 기준에 "${w}" 없음`);
    assert.equal(await page.locator(".co-pick", { hasText: "P02·P04 Agent" }).count(), 50);
    await page.screenshot({ path: `${out}/desktop_list.png` });
  });

  for (const [ticker, name, value] of [["024110", "기업은행", "33,561"], ["105560", "KB금융", "27,404"], ["005930", "삼성전자", "1,275,161"]]) {
    await scenario(`② ${name} 상세: P02·P04 탭, PC 결과 파일, 보류`, async () => {
      await go(page, `/app/company/${ticker}`);
      await page.getByRole("heading", { name, level: 1 }).waitFor();
      await page.getByText("검증 전 결과").waitFor();
      await page.locator(".co-seg td", { hasText: value }).first().waitFor();
      assert.ok(await page.getByText("PC 결과 파일").count(), "출처가 PC 결과 파일이 아님");
      if (ticker !== "005930") assert.ok(await page.getByText("이자수익").count(), "이자수익 표기 없음");
      await page.screenshot({ path: `${out}/desktop_${ticker}_p02.png` });
      await page.getByRole("tab", { name: "기술적 분석 (P04)" }).click();
      await page.locator(".co-obs .o", { hasText: "RSI(14)" }).first().waitFor();
      assert.equal(await page.locator(".co-fc .f", { hasText: "보류" }).count(), 4);
      await page.screenshot({ path: `${out}/desktop_${ticker}_p04.png` });
      await page.getByRole("tab", { name: "Agent 보고서" }).click();
      await page.getByRole("heading", { name: /설명/ }).first().waitFor();
    });
  }

  await scenario("③ 챗봇 예시 질문 4개: 답·출처·검증 전, 은행은 매출이라 부르지 않음", async () => {
    await go(page, "/app/company");
    await page.getByRole("button", { name: "AI 챗봇 열기" }).click();
    for (const s of QA) await page.locator(".cw-sugg button", { hasText: s.q }).waitFor();
    await page.screenshot({ path: `${out}/desktop_chat_chips.png` });
    let n = 0;
    for (const s of QA) {
      const t = Date.now();
      if (n === 0) await page.locator(".cw-sugg button", { hasText: s.q }).click();
      else {
        await page.getByLabel("챗봇 질문").fill(s.q);
        await page.getByRole("button", { name: "챗봇에 보내기" }).click();
      }
      const turn = page.locator(".cw-turn").nth(n);
      await turn.locator(".cw-text").waitFor();
      const text = await turn.locator(".cw-text").innerText();
      const src = await turn.locator(".cw-src").innerText();
      answers.push({ q: s.q, firstLine: text.split("\n")[0], answer: text, sources: src, ms: Date.now() - t });
      for (const w of s.has) assert.ok(text.includes(w), `${s.q}: "${w}" 없음\n${text}`);
      if (s.notSales) assert.ok(!text.replace(/'매출'로 보면 안 됩니다/, "").includes("매출"), `${s.q}: 은행 답에 매출\n${text}`);
      n += 1;
    }
    await page.screenshot({ path: `${out}/desktop_chat_answers.png` });
  });

  await scenario("③-2 기존 챗봇 동작: HBM 보류, 최대낙폭 Agent 근거, 실시간 공시는 서버 필요 안내", async () => {
    await go(page, "/app/company/005930");
    await page.getByRole("button", { name: "AI 챗봇 열기" }).click();
    const ask = async (q, i) => {
      await page.getByLabel("챗봇 질문").fill(q);
      await page.getByRole("button", { name: "챗봇에 보내기" }).click();
      const c = page.locator(".cw-turn").nth(i).locator(".cw-text");
      await c.waitFor();
      const text = await c.innerText();
      answers.push({ q, firstLine: text.split("\n")[0], answer: text });
      return text;
    };
    const hbm = await ask("삼성전자 HBM 매출은 얼마야?", 0);
    assert.ok(hbm.includes("TARGET_NOT_DISCLOSED") && hbm.includes("검증 전") && hbm.includes("p02_out/"), hbm);
    const mdd = await ask("SK하이닉스 최대낙폭은?", 1);
    assert.ok(mdd.includes("SK하이닉스") && mdd.includes("최대낙폭") && mdd.includes("p04_out/") && mdd.includes("검증 전"), mdd);
    const dis = await ask("현대차 최근 공시 알려줘", 2);
    assert.ok(dis.includes("서버 없이 여는 단일 HTML에서는 실시간 공시를 부를 수 없습니다"), dis);
    const op = await ask("기아 영업이익 얼마야?", 3);
    assert.ok(op.includes("서버 없이 여는 단일 HTML"), op);
  });

  await scenario("③-3 AI에게 질문 화면도 Agent 결과로 답한다", async () => {
    await go(page, "/app/ask");
    await page.getByLabel("질문").fill("기업은행 부문별 이자수익 알려줘");
    await page.getByRole("button", { name: "보내기" }).click();
    await page.locator(".a-card .text", { hasText: "기업은행 부문별 이자수익" }).first().waitFor();
    await page.locator(".src-card", { hasText: "p02_out/" }).first().waitFor();
    await page.getByText("추론 INF-017").first().waitFor();
    await page.screenshot({ path: `${out}/desktop_ask.png` });
  });

  await scenario("④ 모바일(390px): 목록·상세·챗봇, 가로 넘침 없음", async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await m.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.setDefaultTimeout(30000);
    const noOverflow = async (label) => {
      const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(o <= 1, `${label} 가로 넘침 ${o}px`);
    };
    await go(p, "/app/company");
    await p.locator(".co-pick").first().waitFor();
    await p.locator(".bundle-note").waitFor();
    await noOverflow("목록");
    await p.locator(".bundle-note").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/mobile_list.png` });
    for (const t of ["024110", "105560", "005930"]) {
      await go(p, `/app/company/${t}`);
      await p.getByText("검증 전 결과").waitFor();
      await p.locator(".co-seg td").first().waitFor();
      await noOverflow(t);
    }
    await p.screenshot({ path: `${out}/mobile_005930_p02.png` });
    await go(p, "/app/company/024110");
    await p.getByRole("button", { name: "AI 챗봇 열기" }).click();
    await p.locator(".cw-sugg button").first().waitFor();
    await p.screenshot({ path: `${out}/mobile_chat_chips.png` });
    await p.locator(".cw-sugg button", { hasText: "기업은행 부문별 이자수익" }).click();
    await p.locator(".cw-text", { hasText: "기업은행 부문별 이자수익" }).waitFor();
    await noOverflow("챗봇");
    await p.screenshot({ path: `${out}/mobile_chat_answer.png` });
    await m.close();
  });

  await scenario("⑤ 런타임 오류·외부 요청 없음", async () => {
    assert.deepEqual(errors, []);
    console.log(`  외부 요청 ${external.length}건 ${[...new Set(external)].slice(0, 5).join(", ")}`);
    assert.deepEqual(external, []);
  });
} finally {
  await browser.close();
}

writeFileSync(`${out}/answers.json`, JSON.stringify(answers, null, 2));
for (const a of answers) console.log(`Q. ${a.q}\n   A. ${a.firstLine}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
