// 로컬 SQLite (Node 내장 node:sqlite). 외부 DB 서버 없이 data/ 폴더 안에만 파일을 만듭니다.
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DB, SCHEMA, seed } from "./db-core.js";

// vite/vitest 가 node:sqlite 의 node: 접두사를 지우지 않도록 require 로 불러옵니다.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
export type { DB } from "./db-core.js";
export { learningState } from "./db-core.js";

export function openDb(path = process.env.SIJANG_DB ?? resolve("data/sijangnote.db"), reset = false): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path) as DatabaseSyncT & DB;
  db.exec("PRAGMA journal_mode = WAL;");
  if (reset) db.exec("DROP TABLE IF EXISTS reports; DROP TABLE IF EXISTS progress; DROP TABLE IF EXISTS watchlist; DROP TABLE IF EXISTS chats;");
  db.exec(SCHEMA);
  seed(db);
  return db;
}
