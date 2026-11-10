// DB 공용 부분: 시드와 학습 상태 계산. node:sqlite(서버)와 브라우저 메모리 DB(단일 HTML) 둘 다에서 씁니다.
import { CHAPTERS, SEED_REPORTS } from "./content.js";
import { evaluate } from "./report.js";
import { WATCHLIST } from "./market.js";

type RunResult = { lastInsertRowid: number | bigint; changes: number | bigint };
export type Stmt = { run(...a: unknown[]): RunResult; get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] };
export type DB = { prepare(sql: string): Stmt; exec(sql: string): void };

export const SCHEMA = `
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, kind TEXT NOT NULL, created TEXT NOT NULL,
      text TEXT NOT NULL, evaluation TEXT NOT NULL, history TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS progress (chapter_id TEXT PRIMARY KEY, done INTEGER NOT NULL DEFAULT 0, read_sec INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS watchlist (code TEXT PRIMARY KEY, ord INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, result TEXT NOT NULL, created TEXT NOT NULL);
  `;

export function seed(db: DB) {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM reports").get() as { n: number }).n;
  if (n === 0) {
    const ins = db.prepare("INSERT INTO reports (title, kind, created, text, evaluation) VALUES (?, ?, ?, ?, ?)");
    for (const r of [...SEED_REPORTS].reverse()) ins.run(r.title, r.kind, r.date, r.text, JSON.stringify(evaluate(r.text)));
  }
  const p = (db.prepare("SELECT COUNT(*) AS n FROM progress").get() as { n: number }).n;
  if (p === 0) {
    // [관찰] 사이드바 'ETF 입문 3/7': 1·2장 완료, 3장 진행 중 (화면 02, 04)
    const ins = db.prepare("INSERT INTO progress (chapter_id, done, read_sec) VALUES (?, ?, ?)");
    ins.run(CHAPTERS[0].id, 1, CHAPTERS[0].readMin * 60);
    ins.run(CHAPTERS[1].id, 1, CHAPTERS[1].readMin * 60);
    ins.run(CHAPTERS[2].id, 0, 0);
  }
  const w = (db.prepare("SELECT COUNT(*) AS n FROM watchlist").get() as { n: number }).n;
  if (w === 0) WATCHLIST.forEach((c, i) => db.prepare("INSERT INTO watchlist (code, ord) VALUES (?, ?)").run(c, i));
}

/** [추론 INF-009 · 확신도 중간] 진행 중인 장과 남은 읽기 시간 */
export function learningState(db: DB) {
  const rows = db.prepare("SELECT chapter_id, done, read_sec FROM progress").all() as { chapter_id: string; done: number; read_sec: number }[];
  const map = new Map(rows.map((r) => [r.chapter_id, r]));
  const doneCount = CHAPTERS.filter((c) => map.get(c.id)?.done).length;
  const current = CHAPTERS.find((c) => !map.get(c.id)?.done) ?? CHAPTERS[CHAPTERS.length - 1];
  const readSec = map.get(current.id)?.read_sec ?? 0;
  return {
    total: CHAPTERS.length,
    done: doneCount,
    current: { id: current.id, ord: current.ord, title: current.title },
    remainingMin: Math.max(1, Math.ceil(current.readMin - readSec / 60)),
    chapters: CHAPTERS.map((c) => ({ id: c.id, ord: c.ord, title: c.title, done: !!map.get(c.id)?.done })),
    inferred: "INF-009",
  };
}
