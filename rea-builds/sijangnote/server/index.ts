import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

// 기본 포트(3000/5173/8080)와 겹치지 않도록 4318 을 씁니다. 127.0.0.1 에만 열어 외부 노출을 막습니다.
const PORT = Number(process.env.API_PORT ?? 4318);
const HOST = process.env.HOST ?? "127.0.0.1";

const db = openDb();
const root = new Hono();
root.route("/", createApp(db));

// Windows 에서도 동작하도록 환경변수 대신 --prod 인자도 받습니다.
const prod = process.env.NODE_ENV === "production" || process.argv.includes("--prod");
if (prod && existsSync("dist/index.html")) {
  root.use("/*", serveStatic({ root: "./dist" }));
  const html = readFileSync("dist/index.html", "utf8");
  root.get("*", (c) => c.html(html));
}

serve({ fetch: root.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`[시장노트] API http://${HOST}:${info.port}/api`);
});
