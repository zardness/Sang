// 단일 HTML에 넣을 Agent 결과 묶음을 만듭니다.  npm run agent:bundle
//  - agents.config.json 의 P02/P04 폴더에서 server/agents.ts 의 latestRun 규칙 그대로 종목별 최신 결과(주장 있는 것)를 고릅니다.
//  - 앱이 읽는 파일만 standalone/agent-results/ 로 복사합니다(result.json, company_revenue.csv, obs_table.csv, persona_reports/report_*.md).
//    .env·캐시·원문 ZIP 은 열지도 복사하지도 않습니다. 원본 폴더는 읽기만 합니다.
//  - 크기를 줄이려고 앱이 쓰지 않는 필드·구역을 뺍니다(standalone/agent-bundle.ts). 원본과 슬림의 앱 결과가 같은지 비교하고, 다르면 실패합니다.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { AgentId, agentAvailable, agentConfig, agentDocs, latestRun, LEVELS, loadReport, loadSummary, parseLooseJson, personaFiles, STYLES } from "../server/agents.js";
import { UNIVERSE } from "../server/universe.js";
import { BundleManifest, BundleRun, expandShared, slimPersonas, slimResult } from "../standalone/agent-bundle.js";

const OUT = resolve("standalone/agent-results");
if (!OUT.endsWith(`${sep}standalone${sep}agent-results`)) throw new Error("출력 경로가 이상합니다");
const AGENTS: AgentId[] = ["p02", "p04"];
const FINALS = { p02: "02_Agent_Final_V1106", p04: "04_Agent_Final_V1106" };
const PACKAGE = { p02: "P02_Agent", p04: "P04_Agent" };
const COPY_CSV = { p02: "company_revenue.csv", p04: "obs_table.csv" };
/** 이 파일 이름만 묶음에 들어갈 수 있다 */
const ALLOWED = /^(manifest\.json|result\.json|company_revenue\.csv|obs_table\.csv|_shared\.json|report_L[1-4]_[a-z]+\.md)$/;

const cfg = agentConfig();
for (const a of AGENTS) if (!cfg[a] || !existsSync(join(cfg[a]!, `${a}_out`))) throw new Error(`${a} 결과 폴더를 찾지 못했습니다. agents.config.json 을 확인하세요.`);

const walk = (d: string, o: string[] = []) => {
  for (const n of readdirSync(d)) {
    if (n === "__pycache__") continue;
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f, o);
    else o.push(f);
  }
  return o;
};
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** 결과에 적힌 코드 해시가 지금 패키지 .py 와 같은가 (패키지는 읽기만 한다) */
function codeMatches(a: AgentId, hashes: Record<string, string>) {
  const py = walk(join(cfg[a]!, PACKAGE[a])).filter((f) => f.endsWith(".py"));
  const entries = Object.entries(hashes ?? {});
  return entries.length > 0 && entries.every(([k, h]) => {
    const f = py.find((x) => x.replace(/\\/g, "/").endsWith(`/${k}`)) ?? py.find((x) => basename(x) === basename(k));
    return !!f && sha(readFileSync(f)) === h;
  });
}
/** 이 실행 폴더 이름이 어느 노트북 출력에 나오는가 (파일 이름만 기록) */
function notebooksOf(a: AgentId, run: string) {
  const id = run.split("/").at(-1)!;
  return readdirSync(cfg[a]!).filter((n) => n.endsWith(".ipynb") && readFileSync(join(cfg[a]!, n), "utf8").includes(id));
}

rmSync(OUT, { recursive: true, force: true });
let rawBytes = 0, slimBytes = 0;
const write = (rel: string[], text: string) => {
  if (!ALLOWED.test(rel.at(-1)!)) throw new Error(`묶음에 넣을 수 없는 파일: ${rel.join("/")}`);
  const f = join(OUT, ...rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
  slimBytes += Buffer.byteLength(text);
};

const manifest: BundleManifest = {
  bundledAt: new Date().toISOString(),
  finals: FINALS,
  agents: { p02: { companies: 0, missing: [], runs: [] }, p04: { companies: 0, missing: [], runs: [] } },
  finalRerun: [],
  note: "",
  slim: {
    rawBytes: 0,
    slimBytes: 0,
    removed: [
      "result.json: 앱이 읽지 않는 필드(evidence 내용, codeHashes, toolLog 등)와 표에 쓰지 않는 주장 내용",
      "persona_reports: 화면이 읽지 않는 구역('주장별 근거·산식 상세', '검증·재현 상세', '용어 해설', '검토 맥락')과 줄('근거 ID', '산식 ID'), 보류 JSON 의 안 쓰는 필드",
      "persona_reports: 16개 보고서에 같은 구역(꼭 알아야 할 보류·모든 보류·확인된 주장)은 _shared.json 에 한 번만 저장",
    ],
  },
};

for (const a of AGENTS) {
  const byRun = new Map<string, BundleRun>();
  for (const co of UNIVERSE) {
    if (!agentAvailable(a, co.ticker)) {
      manifest.agents[a].missing.push(co.ticker);
      continue;
    }
    const rd = latestRun(a, co.ticker);
    if (rd.kind !== "pc") throw new Error(`${a} ${co.ticker}: PC 결과가 아닙니다`);
    const base = [a, ...rd.run.split("/"), co.ticker];
    const rawResult = readFileSync(join(rd.dir, "result.json"), "utf8");
    const r = parseLooseJson<Record<string, unknown>>(rawResult);
    rawBytes += Buffer.byteLength(rawResult);
    write([...base, "result.json"], JSON.stringify(slimResult(a, r)));
    const csv = join(rd.dir, COPY_CSV[a]);
    if (existsSync(csv)) {
      const t = readFileSync(csv, "utf8");
      rawBytes += Buffer.byteLength(t);
      write([...base, COPY_CSV[a]], t);
    }
    const reports = personaFiles(rd.dir).map((p) => ({ name: basename(p.file), md: readFileSync(p.file, "utf8") }));
    rawBytes += reports.reduce((n, x) => n + Buffer.byteLength(x.md), 0);
    const slim = slimPersonas(reports);
    for (const f of slim.files) write([...base, "persona_reports", f.name], f.md);
    if (Object.keys(slim.shared).length) write([...base, "persona_reports", "_shared.json"], JSON.stringify(slim.shared));

    manifest.agents[a].companies += 1;
    const hash = sha(JSON.stringify(r.codeHashes ?? {})).slice(0, 12);
    const entry = byRun.get(rd.run) ?? { run: rd.run, tickers: [], codeVersion: String(r.codeVersion ?? ""), codeHash: hash, codeMatchesPackage: codeMatches(a, r.codeHashes as Record<string, string>), asOf: [], notebooks: notebooksOf(a, rd.run) };
    entry.tickers.push(co.ticker);
    if (!entry.asOf.includes(String(r.asOf))) entry.asOf.push(String(r.asOf));
    byRun.set(rd.run, entry);
  }
  manifest.agents[a].runs = [...byRun.values()].sort((x, y) => x.run.localeCompare(y.run));
}

// 최종본 이름(_final_)이 붙은 노트북으로 돌린 실행에 든 기업만 "최종본 재실행"으로 적는다
for (const r of manifest.agents.p02.runs) {
  const nb = r.notebooks.find((n) => /_final_/i.test(n));
  if (nb) for (const t of r.tickers) manifest.finalRerun.push({ agent: "P02", ticker: t, name: UNIVERSE.find((c) => c.ticker === t)!.name, run: r.run, notebook: nb });
}
const allMatch = AGENTS.every((a) => manifest.agents[a].runs.every((r) => r.codeMatchesPackage));
const others = manifest.agents.p02.companies - manifest.finalRerun.length;
manifest.note = [
  manifest.finalRerun.length ? `최종본으로 다시 돌린 결과는 ${manifest.finalRerun.map((x) => `${x.name}(${x.agent})`).join(", ")}입니다.` : "",
  `나머지 P02 ${others}개와 P04는 같은 수정이 들어간 실행 사본의 결과입니다.`,
  allMatch ? "결과에 적힌 코드 해시는 모두 지금 최종본 패키지와 같습니다." : "일부 결과의 코드 해시가 지금 패키지와 다릅니다(실행 폴더 정보 참고).",
].filter(Boolean).join(" ");
manifest.slim.rawBytes = rawBytes;
manifest.slim.slimBytes = slimBytes;
write(["manifest.json"], JSON.stringify(manifest, null, 1));

// ── 원본과 슬림의 앱 결과 비교 ─────────────────────────────
function materialize(): string {
  // fs-shim 이 읽는 그대로(공유 구역 복원) 임시 폴더에 풀어 server/agents.ts 로 읽어 본다
  const tmp = mkdtempSync(join(tmpdir(), "sijang-bundle-"));
  for (const f of walk(OUT)) {
    const rel = f.slice(OUT.length + 1);
    const to = join(tmp, rel);
    mkdirSync(dirname(to), { recursive: true });
    if (f.endsWith(".md")) {
      const shared = join(dirname(f), "_shared.json");
      const text = readFileSync(f, "utf8");
      writeFileSync(to, existsSync(shared) ? expandShared(text, JSON.parse(readFileSync(shared, "utf8"))) : text);
    } else writeFileSync(to, readFileSync(f));
  }
  writeFileSync(join(tmp, "agents.config.json"), JSON.stringify({ p02: join(tmp, "p02"), p04: join(tmp, "p04") }));
  return tmp;
}
function appView() {
  const view: Record<string, unknown> = {};
  for (const a of AGENTS) for (const co of UNIVERSE) {
    view[`${a}/${co.ticker}`] = loadSummary(a, co.ticker);
    for (const l of LEVELS) for (const s of STYLES) {
      const rep = loadReport(a, co.ticker, l, s);
      if (rep) view[`${a}/${co.ticker}/${l}_${s}`] = { ...rep, updated: "" };
    }
  }
  view.docs = agentDocs();
  return view;
}
const original = appView();
const tmp = materialize();
const saved = process.env.AGENTS_CONFIG;
const savedDirs = [process.env.P02_DIR, process.env.P04_DIR];
delete process.env.P02_DIR;
delete process.env.P04_DIR;
process.env.AGENTS_CONFIG = join(tmp, "agents.config.json");
const slimmed = appView();
if (saved === undefined) delete process.env.AGENTS_CONFIG;
else process.env.AGENTS_CONFIG = saved;
if (savedDirs[0]) process.env.P02_DIR = savedDirs[0];
if (savedDirs[1]) process.env.P04_DIR = savedDirs[1];
rmSync(tmp, { recursive: true, force: true });
const keys = Object.keys(original);
const differ = keys.filter((k) => !isDeepStrictEqual(original[k], slimmed[k]));
if (differ.length || keys.length !== Object.keys(slimmed).length) {
  console.error(`슬림 결과가 원본과 다릅니다: ${differ.slice(0, 10).join(", ")} (총 ${differ.length}개)`);
  process.exit(1);
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
for (const a of AGENTS) {
  const m = manifest.agents[a];
  console.log(`${a.toUpperCase()}: 기업 ${m.companies}개, 실행 폴더 ${m.runs.length}개${m.missing.length ? `, 결과 없음 ${m.missing.join(",")}` : ""}`);
  for (const r of m.runs) console.log(`  ${r.run}  ${r.tickers.length}개  기준일 ${r.asOf.join(",")}  ${r.codeVersion}  코드 일치 ${r.codeMatchesPackage}  노트북 ${r.notebooks.join(", ") || "-"}`);
}
console.log(manifest.note);
console.log(`크기: 원본 ${mb(rawBytes)} → 묶음 ${mb(slimBytes)}`);
console.log(`비교: 앱 결과 ${keys.length}개 항목(요약·페르소나 보고서·챗봇 문서)이 원본과 같습니다.`);
