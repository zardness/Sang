import { Hono } from "hono";
import { CHAPTERS, GLOSSARY, SERIES } from "./content.js";
import { agentAnalysis, briefings, chartSeries, forecast, headline, marketSummary } from "./analysis.js";
import { downsample, find, INSTRUMENTS, quote, RANGES } from "./market.js";
import { answer, getIndex, tokens } from "./rag.js";
import { applySuggestion, evaluate, Evaluation } from "./report.js";
import { DB, learningState } from "./db-core.js";
import { INFERENCES, inferenceHeader } from "./inference.js";
import { AgentId, agentAvailable, agentBundleInfo, agentsFor, businessQuery, LEVELS, loadReport, loadSummary, STYLES } from "./agents.js";
import { dart, DartError } from "./dart.js";
import { dartAnswer } from "./dart-chat.js";
import { agentAnswer } from "./agent-chat.js";
import { findUniverse, SECTORS, UNIVERSE } from "./universe.js";

type ReportRow = { id: number; title: string; kind: string; created: string; text: string; evaluation: string; history: string };

const MAX_REPORT_BYTES = 200_000;

export function createApp(db: DB) {
  const app = new Hono().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/inferences", (c) => c.json(INFERENCES));

  // ── 시장 ──────────────────────────────────────────────
  app.get("/market/summary", (c) => {
    c.header("X-Rea-Inferred", "INF-001");
    return c.json({ asOf: "15:30", quotes: marketSummary() });
  });

  app.get("/market/:code/series", (c) => {
    const inst = find(c.req.param("code"));
    if (!inst) return c.json({ error: "종목을 찾을 수 없습니다." }, 404);
    const range = c.req.query("range") ?? "1y";
    if (!(range in RANGES)) return c.json({ error: "range 는 1w, 1m, 1y, 5y, all 중 하나입니다." }, 400);
    c.header("X-Rea-Inferred", "INF-001");
    return c.json({ code: inst.code, range, points: downsample(chartSeries(inst, range)) });
  });

  app.get("/dashboard", (c) => {
    const learn = learningState(db);
    const items = briefings({ chapterTitle: `${SERIES.short} ${learn.current.ord}장 ${learn.current.title}`, remainingMin: learn.remainingMin });
    c.header("X-Rea-Inferred", "INF-001,INF-002,INF-011");
    return c.json({ headline: headline(), subline: "오늘 바뀐 것만 짧게 모았습니다. 자세한 분석은 AI 패널을 열어 확인하세요.", briefings: items, quotes: marketSummary() });
  });

  // ── 종목·ETF ─────────────────────────────────────────
  app.get("/etfs", (c) => c.json(INSTRUMENTS.filter((i) => i.etf).map((i) => ({ ...quote(i), category: i.etf!.category, ter: i.etf!.ter, aum: i.etf!.aum }))));

  app.get("/etfs/:code", (c) => {
    const inst = find(c.req.param("code"));
    if (!inst?.etf) return c.json({ error: "ETF를 찾을 수 없습니다." }, 404);
    const e = inst.etf;
    return c.json({
      ...quote(inst),
      category: e.category,
      stats: [
        { label: "총보수", value: `${e.ter}%`, term: "총보수" },
        { label: "순자산", value: e.aum, term: "순자산" },
        { label: "추적 오차", value: `${e.trackingError}%`, term: "추적 오차" },
        { label: "분배금", value: e.distribution, term: "분배금" },
        { label: "상장일", value: e.listed },
      ],
      holdings: e.holdings,
      top: e.top,
      overseas: e.overseas,
      related: CHAPTERS.filter((ch) => (e.overseas ? ["etf-101-2", "etf-101-3"] : ["etf-101-1", "etf-101-3"]).includes(ch.id) || ch.id === "etf-101-5").map((ch) => ({ id: ch.id, ord: ch.ord, title: ch.title })),
      news: [
        { title: `${inst.name}, 순자산 ${e.aum} 돌파`, source: "가상 뉴스", date: "11월 3일" },
        { title: `${e.overseas ? "환율 하락에 해외 ETF 원화 수익 주춤" : "외국인 순매수에 국내 지수 강세"}`, source: "가상 뉴스", date: "11월 2일" },
        { title: "연말 분배금 시즌, ETF 분배 일정 정리", source: "가상 뉴스", date: "10월 30일" },
      ],
    });
  });

  app.get("/etfs/:code/forecast", (c) => {
    const inst = find(c.req.param("code"));
    if (!inst) return c.json({ error: "종목을 찾을 수 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-001,INF-003");
    return c.json(forecast(inst));
  });

  app.get("/etfs/:code/agent", (c) => {
    const inst = find(c.req.param("code"));
    if (!inst?.etf) return c.json({ error: "ETF를 찾을 수 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-003,INF-004");
    return c.json(agentAnalysis(inst));
  });

  app.get("/watchlist", (c) => {
    const rows = db.prepare("SELECT code FROM watchlist ORDER BY ord").all() as { code: string }[];
    return c.json(rows.map((r) => find(r.code)).filter(Boolean).map((i) => quote(i!)));
  });
  app.post("/watchlist/:code", (c) => {
    const inst = find(c.req.param("code"));
    if (!inst) return c.json({ error: "종목을 찾을 수 없습니다." }, 404);
    const max = (db.prepare("SELECT COALESCE(MAX(ord), -1) AS m FROM watchlist").get() as { m: number }).m;
    db.prepare("INSERT OR IGNORE INTO watchlist (code, ord) VALUES (?, ?)").run(inst.code, max + 1);
    return c.json({ ok: true });
  });
  app.delete("/watchlist/:code", (c) => {
    db.prepare("DELETE FROM watchlist WHERE code = ?").run(c.req.param("code").toUpperCase());
    return c.json({ ok: true });
  });

  // ── 기업 분석 (P02·P04 Agent 결과) ────────────────────
  app.get("/companies", (c) => {
    c.header("X-Rea-Inferred", "INF-012,INF-014");
    return c.json(
      UNIVERSE.map((co) => {
        const agents = agentsFor(co.ticker);
        const p04 = agents.p04 ? loadSummary("p04", co.ticker) : null;
        const close = p04 && "observations" in p04 ? p04.observations.find((o) => o.id === "OBS_CLOSE")?.value ?? null : null;
        return { ...co, agents, agent: agents.p02 || agents.p04, close, asOf: p04?.asOf ?? "", phase: p04 && "phase" in p04 ? p04.phase : "", href: `/app/company/${co.ticker}` };
      }),
    );
  });
  app.get("/companies/sectors", (c) => c.json(SECTORS));
  app.get("/agents/bundle", (c) => c.json(agentBundleInfo()));

  // ── OpenDART 실시간 공시 ─────────────────────────────
  const dartErr = (e: unknown) => ({ code: e instanceof DartError ? e.code : "ERR", message: e instanceof DartError ? e.message : "OpenDART 호출 중 오류가 났습니다." });
  app.get("/dart/status", (c) => c.json(dart().status()));
  app.get("/dart/feed", async (c) => {
    c.header("X-Rea-Inferred", "INF-015");
    const d = dart();
    if (!d.configured) return c.json({ status: d.status(), items: [] });
    const days = Math.min(Math.max(Number(c.req.query("days") ?? 3) || 3, 1), 7);
    try {
      return c.json({ status: d.status(), days, items: await d.feed(days), fetchedAt: new Date().toISOString() });
    } catch (e) {
      return c.json({ status: d.status(), days, items: [], error: dartErr(e) });
    }
  });
  app.get("/companies/:ticker/dart", async (c) => {
    const co = findUniverse(c.req.param("ticker"));
    if (!co) return c.json({ error: "기업을 찾을 수 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-014,INF-015");
    const d = dart();
    if (!d.configured) return c.json({ company: co, status: d.status(), overview: null, disclosures: [], financials: null, errors: [] });
    const errors: { part: string; code: string; message: string }[] = [];
    const run = async <T,>(part: string, f: () => Promise<T>) => {
      try {
        return await f();
      } catch (e) {
        errors.push({ part, ...dartErr(e) });
        return null;
      }
    };
    // 고유번호 목록을 먼저 한 번만 받도록 순서대로 부른다
    const disclosures = (await run("공시 목록", () => d.disclosures(co.ticker, 90))) ?? [];
    const [overview, financials] = await Promise.all([run("기업개황", () => d.overview(co.ticker)), run("주요 재무", () => d.financials(co.ticker))]);
    return c.json({ company: co, status: d.status(), overview, disclosures, financials, errors, fetchedAt: new Date().toISOString() });
  });
  const agentOf = (s: string): AgentId | null => (s === "p02" || s === "p04" ? s : null);
  app.get("/companies/:ticker/:agent", (c) => {
    const agent = agentOf(c.req.param("agent"));
    if (!agent || !findUniverse(c.req.param("ticker")) || !agentAvailable(agent, c.req.param("ticker"))) return c.json({ error: "기업 또는 Agent를 찾을 수 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-012");
    return c.json(loadSummary(agent, c.req.param("ticker")));
  });
  app.get("/companies/:ticker/:agent/report", (c) => {
    const agent = agentOf(c.req.param("agent"));
    if (!agent || !findUniverse(c.req.param("ticker")) || !agentAvailable(agent, c.req.param("ticker"))) return c.json({ error: "기업 또는 Agent를 찾을 수 없습니다." }, 404);
    const level = c.req.query("level") ?? "L2";
    const style = c.req.query("style") ?? "conservative";
    if (!(LEVELS as readonly string[]).includes(level) || !(STYLES as readonly string[]).includes(style)) return c.json({ error: "level 은 L1~L4, style 은 conservative·aggressive·neutral·undetermined 중 하나입니다." }, 400);
    const r = loadReport(agent, c.req.param("ticker"), level, style);
    if (!r) return c.json({ error: "페르소나 보고서가 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-012");
    return c.json(r);
  });
  app.get("/companies/:ticker/p02/query", (c) => {
    const r = businessQuery(c.req.param("ticker"), (c.req.query("q") ?? "").trim().slice(0, 40));
    if (!r) return c.json({ error: "기업을 찾을 수 없습니다." }, 404);
    c.header("X-Rea-Inferred", "INF-013");
    return c.json(r);
  });

  // ── 학습 ─────────────────────────────────────────────
  app.get("/learn", (c) => {
    c.header("X-Rea-Inferred", "INF-009");
    return c.json({ series: SERIES, ...learningState(db) });
  });
  app.get("/learn/:id", (c) => {
    const ch = CHAPTERS.find((x) => x.id === c.req.param("id"));
    if (!ch) return c.json({ error: "장을 찾을 수 없습니다." }, 404);
    const idx = CHAPTERS.indexOf(ch);
    return c.json({ ...ch, series: SERIES, prev: CHAPTERS[idx - 1]?.id ?? null, next: CHAPTERS[idx + 1]?.id ?? null });
  });
  app.post("/learn/:id/progress", async (c) => {
    const ch = CHAPTERS.find((x) => x.id === c.req.param("id"));
    if (!ch) return c.json({ error: "장을 찾을 수 없습니다." }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { addSec?: number; done?: boolean };
    const add = Math.max(0, Math.min(600, Math.round(Number(body.addSec) || 0)));
    db.prepare(
      `INSERT INTO progress (chapter_id, done, read_sec) VALUES (?, ?, ?)
       ON CONFLICT(chapter_id) DO UPDATE SET read_sec = read_sec + excluded.read_sec, done = MAX(done, excluded.done)`,
    ).run(ch.id, body.done ? 1 : 0, add);
    return c.json(learningState(db));
  });

  app.get("/glossary", (c) => c.json(GLOSSARY));
  app.get("/glossary/:term", (c) => {
    const t = GLOSSARY.find((g) => g.term === decodeURIComponent(c.req.param("term")));
    return t ? c.json(t) : c.json({ error: "용어를 찾을 수 없습니다." }, 404);
  });

  /** [추론 INF-008 · 확신도 중간] 총보수 차이 복리 계산. 기본 가정: 연 6.5% 수익 */
  app.get("/calc/fee", (c) => {
    const principal = Number(c.req.query("principal") ?? 10_000_000);
    const years = Number(c.req.query("years") ?? 10);
    const a = Number(c.req.query("a") ?? 0.07);
    const b = Number(c.req.query("b") ?? 0.25);
    const r = Number(c.req.query("return") ?? 6.5);
    if (![principal, years, a, b, r].every(Number.isFinite) || years < 0 || years > 60) return c.json({ error: "입력값을 확인하세요." }, 400);
    const grow = principal * (1 + r / 100) ** years;
    const diff = grow * ((1 - a / 100) ** years - (1 - b / 100) ** years);
    c.header("X-Rea-Inferred", "INF-008");
    return c.json({ principal, years, a, b, assumedReturn: r, difference: Math.round(diff), inferred: "INF-008" });
  });

  // ── 검색 ─────────────────────────────────────────────
  app.get("/search", (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ instruments: [], companies: [], chapters: [], terms: [] });
    const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();
    const nq = norm(q);
    const qt = new Set(tokens(q));
    const overlap = (s: string) => {
      const t = tokens(s);
      return t.length ? t.filter((x) => qt.has(x)).length / Math.max(qt.size, 1) : 0;
    };
    const rank = <T,>(items: T[], text: (t: T) => string) =>
      items
        .map((it) => ({ it, s: norm(text(it)).includes(nq) ? 2 : overlap(text(it)) }))
        .filter((x) => x.s >= 0.34)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map((x) => x.it);
    return c.json({
      instruments: rank(INSTRUMENTS, (i) => `${i.name} ${i.code} ${i.etf?.category ?? ""}`).map((i) => ({ ...quote(i), href: i.etf ? `/app/etf/${i.code}` : `/app/dashboard` })),
      companies: rank(UNIVERSE, (co) => `${co.name} ${co.ticker} ${co.sector} 기업 분석 공시`).map((co) => ({ ...co, href: `/app/company/${co.ticker}` })),
      chapters: rank(CHAPTERS, (ch) => `${ch.title} ${ch.headline} ${ch.body.join(" ")}`).map((ch) => ({ id: ch.id, title: `${ch.ord}장 ${ch.title}`, href: `/app/learn/${ch.id}` })),
      terms: rank(GLOSSARY, (t) => `${t.term} ${t.en} ${t.def}`).map((t) => ({ term: t.term, def: t.def })),
    });
  });

  // ── AI 질문 ──────────────────────────────────────────
  app.get("/ask", (c) => {
    const rows = db.prepare("SELECT id, question, result, created FROM chats ORDER BY id").all() as { id: number; question: string; result: string; created: string }[];
    return c.json({ docCount: getIndex().docs.length, history: rows.map((r) => ({ id: r.id, question: r.question, created: r.created, ...JSON.parse(r.result) })) });
  });
  app.post("/ask", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { question?: string };
    const q = (body.question ?? "").trim();
    if (!q) return c.json({ error: "질문을 입력하세요." }, 400);
    if (q.length > 500) return c.json({ error: "질문은 500자 이내로 입력하세요." }, 400);
    const result = agentAnswer(q) ?? (await dartAnswer(q, dart())) ?? answer(q);
    const info = db.prepare("INSERT INTO chats (question, result, created) VALUES (?, ?, ?)").run(q, JSON.stringify(result), new Date().toISOString());
    c.header("X-Rea-Inferred", result.inferred);
    return c.json({ id: Number(info.lastInsertRowid), question: q, ...result });
  });
  app.delete("/ask", (c) => {
    db.exec("DELETE FROM chats");
    return c.json({ ok: true });
  });

  // ── 보고서 평가 ──────────────────────────────────────
  const toReport = (r: ReportRow) => ({ id: r.id, title: r.title, kind: r.kind, created: r.created, text: r.text, evaluation: JSON.parse(r.evaluation) as Evaluation, history: JSON.parse(r.history) as { at: string; total: number }[] });

  app.get("/reports", (c) => {
    const rows = db.prepare("SELECT * FROM reports ORDER BY created DESC, id DESC").all() as ReportRow[];
    c.header("X-Rea-Inferred", "INF-006,INF-007");
    return c.json(rows.map(toReport));
  });

  app.post("/reports", async (c) => {
    let title = "", text = "", kind = "TXT";
    const ct = c.req.header("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return c.json({ error: "파일을 올려 주세요." }, 400);
      if (file.size > MAX_REPORT_BYTES) return c.json({ error: "파일은 200KB 이하만 올릴 수 있습니다." }, 413);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["txt", "md"].includes(ext)) return c.json({ error: "지금은 .txt, .md 파일만 평가할 수 있습니다. PDF·Word는 본문을 복사해 붙여 넣어 주세요." }, 415);
      title = file.name.replace(/\.[^.]+$/, "");
      text = await file.text();
      kind = ext === "md" ? "MD" : "TXT";
    } else {
      const body = (await c.req.json().catch(() => ({}))) as { title?: string; text?: string };
      title = (body.title ?? "").trim() || "붙여 넣은 보고서";
      text = body.text ?? "";
    }
    text = text.trim();
    if (text.length < 20) return c.json({ error: "보고서 내용이 너무 짧습니다(20자 이상)." }, 400);
    if (text.length > MAX_REPORT_BYTES) return c.json({ error: "보고서가 너무 깁니다." }, 413);
    const ev = evaluate(text);
    const info = db
      .prepare("INSERT INTO reports (title, kind, created, text, evaluation, history) VALUES (?, ?, ?, ?, ?, ?)")
      .run(title.slice(0, 80), kind, new Date().toISOString().slice(0, 10), text, JSON.stringify(ev), JSON.stringify([{ at: new Date().toISOString(), total: ev.total }]));
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(Number(info.lastInsertRowid)) as ReportRow;
    c.header("X-Rea-Inferred", "INF-006,INF-007");
    return c.json(toReport(row), 201);
  });

  app.post("/reports/:id/rescore", async (c) => {
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(Number(c.req.param("id"))) as ReportRow | undefined;
    if (!row) return c.json({ error: "보고서를 찾을 수 없습니다." }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { text?: string; applyFinding?: number };
    let text = row.text;
    if (typeof body.text === "string" && body.text.trim().length >= 20) text = body.text.trim();
    else if (typeof body.applyFinding === "number") {
      const f = (JSON.parse(row.evaluation) as Evaluation).findings[body.applyFinding];
      if (!f) return c.json({ error: "적용할 제안이 없습니다." }, 400);
      text = applySuggestion(text, f.current, f.suggestion);
    }
    const ev = evaluate(text);
    const history = JSON.parse(row.history) as { at: string; total: number }[];
    if (!history.length) history.push({ at: row.created, total: (JSON.parse(row.evaluation) as Evaluation).total });
    history.push({ at: new Date().toISOString(), total: ev.total });
    db.prepare("UPDATE reports SET text = ?, evaluation = ?, history = ? WHERE id = ?").run(text, JSON.stringify(ev), JSON.stringify(history), row.id);
    c.header("X-Rea-Inferred", "INF-006,INF-007");
    return c.json(toReport({ ...row, text, evaluation: JSON.stringify(ev), history: JSON.stringify(history) }));
  });

  app.delete("/reports/:id", (c) => {
    db.prepare("DELETE FROM reports WHERE id = ?").run(Number(c.req.param("id")));
    return c.json({ ok: true });
  });

  app.notFound((c) => c.json({ error: "없는 API입니다." }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "서버 오류가 발생했습니다." }, 500);
  });
  void inferenceHeader;
  return app;
}
