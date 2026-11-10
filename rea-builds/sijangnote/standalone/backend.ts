// 단일 HTML 안에서 도는 백엔드: 서버와 같은 Hono 앱을 브라우저에서 실행하고, fetch 대신 직접 호출합니다.
import { createApp } from "../server/app";
import { SCHEMA, seed } from "../server/db-core";
import { createMemDb } from "./memdb";

const db = createMemDb();
db.exec(SCHEMA);
seed(db);
const app = createApp(db);

export async function localFetch(url: string, init?: RequestInit) {
  return app.fetch(new Request(new URL(url, "http://sijangnote.local"), init));
}
