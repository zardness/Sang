// P02·P04 노트북 [1-1] 실행 설정에 붙여 넣을 TARGETS·EXTRA_COMPANIES 를 만듭니다.
//   npx tsx scripts/agent-targets.ts --top 10      (50개 목록 앞에서 10개)
//   npx tsx scripts/agent-targets.ts --all         (50개 전부)
//   npx tsx scripts/agent-targets.ts --skip 10 --top 10   (11~20번째)
// DART 고유번호는 앱이 OpenDART에서 받아 둔 data/dart-cache/corpcode.json 에서 찾습니다.
// (앱을 인증키와 함께 한 번 켜고 기업 화면을 열면 이 파일이 생깁니다.) 인증키는 읽지 않습니다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { UNIVERSE } from "../server/universe.js";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const all = process.argv.includes("--all");
const skip = Number(arg("--skip") ?? 0);
const top = all ? UNIVERSE.length : Number(arg("--top") ?? 10);
const picked = UNIVERSE.slice(skip, skip + top);

/** P02 패키지(config.COMPANIES)에 원래 들어 있는 회사 */
const BUILTIN_P02 = new Set(["005930", "000660"]);

const cacheFile = resolve(process.env.DART_CACHE ?? "data/dart-cache", "corpcode.json");
if (!existsSync(cacheFile)) {
  console.error(`DART 고유번호 목록이 없습니다: ${cacheFile}\n앱을 인증키와 함께 켜고(npm run dev) 기업 분석 화면을 한 번 연 뒤 다시 실행하세요.`);
  process.exit(1);
}
const map = (JSON.parse(readFileSync(cacheFile, "utf8")) as { map: Record<string, { corp: string; name: string }> }).map;

const missing = picked.filter((c) => !BUILTIN_P02.has(c.ticker) && !map[c.ticker]);
const extra = picked.filter((c) => !BUILTIN_P02.has(c.ticker) && map[c.ticker]);
const list = (xs: string[]) => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
const p02Targets = picked.filter((c) => BUILTIN_P02.has(c.ticker) || map[c.ticker]).map((c) => c.ticker);

const p02 = `# ── P02 노트북 [1-1] 의 TARGETS·EXTRA_COMPANIES 두 줄을 아래로 바꿔 넣으세요 ──
TARGETS = ${list(p02Targets)}   # ${picked.filter((c) => p02Targets.includes(c.ticker)).map((c) => c.name).join(", ")}
EXTRA_COMPANIES = {
${extra.map((c) => `    '${c.ticker}': ('${c.name}', '${map[c.ticker].corp}'),   # DART 이름: ${map[c.ticker].name}`).join("\n")}
}
`;
const p04 = `# ── P04 노트북 [1-1] 의 TARGETS 한 줄을 아래로 바꿔 넣으세요 ──
TARGETS = ${list(picked.map((c) => c.ticker))}   # ${picked.map((c) => c.name).join(", ")}
# [2-x] 시세 점검표에서 '시세 없음'으로 나오는 종목은 Neon price_daily 에 시세가 없는 것이니 빼고 다시 실행하세요.
`;

const outDir = resolve("agent-targets");
mkdirSync(outDir, { recursive: true });
const tag = all ? "all" : `${skip + 1}-${skip + picked.length}`;
writeFileSync(resolve(outDir, `p02_targets_${tag}.py`), p02);
writeFileSync(resolve(outDir, `p04_targets_${tag}.py`), p04);
console.log(p02);
console.log(p04);
if (missing.length) console.log(`DART 고유번호를 못 찾아 P02에서 뺀 종목: ${missing.map((c) => `${c.name}(${c.ticker})`).join(", ")}`);
console.log(`저장: agent-targets\\p02_targets_${tag}.py, agent-targets\\p04_targets_${tag}.py`);
