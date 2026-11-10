// 단일 HTML용 node:fs 대체: 빌드할 때 묶어 넣은 Agent 파일만 읽기 전용으로 보여 줍니다.
//  - server/agent-snapshot: 노트북 스냅샷(결과 묶음이 없을 때 대신 씀)
//  - standalone/agent-results: npm run agent:bundle 로 묶은 50개 기업 결과. 가상 agents.config.json 으로 연결해
//    서버 모드와 같은 "PC 결과 파일" 경로로 읽습니다.
import { expandShared } from "./agent-bundle";

const snapshot = import.meta.glob("../server/agent-snapshot/**/*.{json,md}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const results = import.meta.glob("./agent-results/**/*.{json,md,csv}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ROOT = "server/agent-snapshot";
const RESULTS = "standalone/agent-results";
const vfs = new Map<string, string>();
for (const [k, v] of Object.entries(snapshot)) vfs.set(k.replace(/^\.\.\/server\/agent-snapshot/, ROOT), v);
for (const [k, v] of Object.entries(results)) vfs.set(k.replace(/^\.\/agent-results/, RESULTS), v);
if (vfs.has(`${RESULTS}/manifest.json`)) vfs.set("agents.config.json", JSON.stringify({ p02: `${RESULTS}/p02`, p04: `${RESULTS}/p04` }));
const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const isDir = (p: string) => [...vfs.keys()].some((k) => k.startsWith(norm(p) + "/"));
const BUILT = new Date(__BUILD_TIME__);

export function existsSync(p: string) {
  const n = norm(p);
  return vfs.has(n) || isDir(n);
}
export function readFileSync(p: string) {
  const n = norm(p);
  const v = vfs.get(n);
  if (v == null) throw new Error(`ENOENT: ${p}`);
  // 페르소나 보고서는 같은 폴더의 _shared.json 에 있는 공유 구역을 되돌려서 준다
  const shared = n.startsWith(RESULTS) && n.endsWith(".md") ? vfs.get(`${n.slice(0, n.lastIndexOf("/"))}/_shared.json`) : undefined;
  return shared ? expandShared(v, JSON.parse(shared)) : v;
}
export function readdirSync(p: string) {
  const pre = norm(p) + "/";
  return [...new Set([...vfs.keys()].filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length).split("/")[0]))];
}
export function statSync() {
  return { mtime: BUILT };
}
export function mkdirSync() {}
export function writeFileSync() {}
export default { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync };
