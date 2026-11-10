// 단일 HTML용 브라우저 메모리 DB. 서버가 쓰는 SQL 문장만 이해하는 작은 구현입니다(SQLite 대신).
// 데이터는 이 브라우저의 localStorage 에만 저장되고, 저장소를 못 쓰면 메모리에서만 동작합니다.
import type { DB, Stmt } from "../server/db-core";

type Report = { id: number; title: string; kind: string; created: string; text: string; evaluation: string; history: string };
type State = { reports: Report[]; progress: { chapter_id: string; done: number; read_sec: number }[]; watchlist: { code: string; ord: number }[]; chats: { id: number; question: string; result: string; created: string }[]; seq: { reports: number; chats: number } };

const KEY = "sijangnote.standalone.v1";
const empty = (): State => ({ reports: [], progress: [], watchlist: [], chats: [], seq: { reports: 0, chats: 0 } });

export function createMemDb(): DB {
  let s: State = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...empty(), ...JSON.parse(raw) };
  } catch {
    /* 저장소를 못 쓰면 메모리만 사용 */
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* 무시 */
    }
  };
  const ok = (id = 0) => ({ lastInsertRowid: id, changes: 1 });
  const byCreatedDesc = (a: Report, b: Report) => (a.created < b.created ? 1 : a.created > b.created ? -1 : b.id - a.id);

  const handlers: Record<string, Partial<Stmt>> = {
    "SELECT COUNT(*) AS n FROM reports": { get: () => ({ n: s.reports.length }) },
    "SELECT COUNT(*) AS n FROM progress": { get: () => ({ n: s.progress.length }) },
    "SELECT COUNT(*) AS n FROM watchlist": { get: () => ({ n: s.watchlist.length }) },
    "INSERT INTO reports (title, kind, created, text, evaluation) VALUES (?, ?, ?, ?, ?)": {
      run: (title, kind, created, text, evaluation) => {
        const id = ++s.seq.reports;
        s.reports.push({ id, title: String(title), kind: String(kind), created: String(created), text: String(text), evaluation: String(evaluation), history: "[]" });
        save();
        return ok(id);
      },
    },
    "INSERT INTO reports (title, kind, created, text, evaluation, history) VALUES (?, ?, ?, ?, ?, ?)": {
      run: (title, kind, created, text, evaluation, history) => {
        const id = ++s.seq.reports;
        s.reports.push({ id, title: String(title), kind: String(kind), created: String(created), text: String(text), evaluation: String(evaluation), history: String(history) });
        save();
        return ok(id);
      },
    },
    "SELECT * FROM reports ORDER BY created DESC, id DESC": { all: () => [...s.reports].sort(byCreatedDesc) },
    "SELECT * FROM reports WHERE id = ?": { get: (id) => s.reports.find((r) => r.id === Number(id)) },
    "UPDATE reports SET text = ?, evaluation = ?, history = ? WHERE id = ?": {
      run: (text, evaluation, history, id) => {
        const r = s.reports.find((x) => x.id === Number(id));
        if (r) Object.assign(r, { text: String(text), evaluation: String(evaluation), history: String(history) });
        save();
        return ok();
      },
    },
    "DELETE FROM reports WHERE id = ?": { run: (id) => ((s.reports = s.reports.filter((r) => r.id !== Number(id))), save(), ok()) },
    "INSERT INTO progress (chapter_id, done, read_sec) VALUES (?, ?, ?)": {
      run: (id, done, sec) => (s.progress.push({ chapter_id: String(id), done: Number(done), read_sec: Number(sec) }), save(), ok()),
    },
    "INSERT INTO progress (chapter_id, done, read_sec) VALUES (?, ?, ?) ON CONFLICT(chapter_id) DO UPDATE SET read_sec = read_sec + excluded.read_sec, done = MAX(done, excluded.done)": {
      run: (id, done, sec) => {
        const r = s.progress.find((x) => x.chapter_id === String(id));
        if (r) Object.assign(r, { read_sec: r.read_sec + Number(sec), done: Math.max(r.done, Number(done)) });
        else s.progress.push({ chapter_id: String(id), done: Number(done), read_sec: Number(sec) });
        save();
        return ok();
      },
    },
    "SELECT chapter_id, done, read_sec FROM progress": { all: () => s.progress.map((r) => ({ ...r })) },
    "SELECT code FROM watchlist ORDER BY ord": { all: () => [...s.watchlist].sort((a, b) => a.ord - b.ord).map((w) => ({ code: w.code })) },
    "SELECT COALESCE(MAX(ord), -1) AS m FROM watchlist": { get: () => ({ m: s.watchlist.reduce((m, w) => Math.max(m, w.ord), -1) }) },
    "INSERT OR IGNORE INTO watchlist (code, ord) VALUES (?, ?)": {
      run: (code, ord) => (s.watchlist.some((w) => w.code === code) || s.watchlist.push({ code: String(code), ord: Number(ord) }), save(), ok()),
    },
    "INSERT INTO watchlist (code, ord) VALUES (?, ?)": { run: (code, ord) => (s.watchlist.push({ code: String(code), ord: Number(ord) }), save(), ok()) },
    "DELETE FROM watchlist WHERE code = ?": { run: (code) => ((s.watchlist = s.watchlist.filter((w) => w.code !== code)), save(), ok()) },
    "SELECT id, question, result, created FROM chats ORDER BY id": { all: () => [...s.chats].sort((a, b) => a.id - b.id) },
    "INSERT INTO chats (question, result, created) VALUES (?, ?, ?)": {
      run: (question, result, created) => {
        const id = ++s.seq.chats;
        s.chats.push({ id, question: String(question), result: String(result), created: String(created) });
        save();
        return ok(id);
      },
    },
  };

  const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
  return {
    prepare(sql: string): Stmt {
      const h = handlers[norm(sql)];
      if (!h) throw new Error(`메모리 DB가 모르는 SQL: ${norm(sql)}`);
      const no = () => {
        throw new Error(`지원하지 않는 호출: ${norm(sql)}`);
      };
      return { run: h.run ?? no, get: h.get ?? no, all: h.all ?? no } as Stmt;
    },
    exec(sql: string) {
      const q = norm(sql);
      if (q === "DELETE FROM chats") (s.chats = []), save();
      // CREATE TABLE·PRAGMA 는 메모리 DB에서 할 일이 없음
    },
  };
}
