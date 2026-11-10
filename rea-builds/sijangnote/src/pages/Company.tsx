// 기업 분석: P02(산업·사업모델) · P04(기술적 분석) Agent 결과 화면.
// 숫자·문장·보류는 Agent 원문 그대로 보여 주고, 앱은 배치와 읽기 순서만 정합니다.
import { Fragment, ReactNode, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, FileText, Lock, Search, ShieldCheck } from "lucide-react";
import { PageMeta } from "../components/Shell";
import { useFetch } from "../lib/useFetch";
import { api } from "../lib/api";
import { DartFeed, DartView } from "./CompanyDart";

// ── 타입 ─────────────────────────────────────────────
type Persona = { level: string; style: string; key: string; label: string };
type Crit = { problem: string; limit: string; resolve: string; count?: number; blocking?: boolean; holdId?: string };
type Common = {
  agent: "P02" | "P04";
  ticker: string;
  name: string;
  source: { kind: "pc" | "snapshot"; label: string; run: string; notebook?: string };
  personas: Persona[];
  reportId: string;
  asOf: string;
  dataMode: string;
  codeVersion: string;
  publicationEligible: boolean;
  counts: { claims: number; suppressed: number; evidence: number; calculations: number; holds: number; blocking: number };
  verifier: { check: string; pass: number; fail: number }[];
  criticalHolds: Crit[];
};
type Seg = { periods: string[]; rows: { name: string; values: (number | null)[]; q4Derived: boolean[]; hidden?: boolean; hiddenAt?: boolean[] }[] };
type P02 = Common & { revenueItem: string; segments: Record<string, Seg>; companyRevenue: { period: string; won: number; method: string; rcept: string }[]; summaries?: Record<string, string> };
type Obs = { id: string; label: string; value: number; unit: string; formula: string; window: string; display: string };
type P04 = Common & {
  status: string;
  phase: string;
  observations: Obs[];
  forecasts: { item: string; status: string; holds: string[] }[];
  holdActions?: { code: string; cause: string; next: string }[];
  prices?: { rows: number; range: string; source: string; adjustment: string; last: { date: string; open: number; high: number; low: number; close: number; volume: number }[] } | null;
  askExample?: { question: string; persona: string; answer: string } | null;
};
type Claim = { id: string; type: string; status: string; text: string; source: string };
type Hold = { id: string; code: string; cause: string; detail: string; blocking: boolean; reviewed: string };
type Report = {
  level: string;
  style: string;
  personaId: string;
  requested: { level: string; style: string };
  substituted: boolean;
  title: string;
  meta: Record<string, string>;
  intro: string[];
  scope: string[];
  summary: string;
  critical: Crit[];
  holds: Hold[];
  claims: Claim[];
  readingOrder: string[];
  questions: string[];
  limits: string[];
};
type Company = { ticker: string; name: string; market: string; sector: string; agent: boolean; agents: { p02: boolean; p04: boolean }; close: number | null; asOf: string; phase: string; href: string };

const LEVELS = [
  { k: "L1", l: "L1 입문" },
  { k: "L2", l: "L2 초급" },
  { k: "L3", l: "L3 중급" },
  { k: "L4", l: "L4 전문가" },
];
const STYLES = [
  { k: "conservative", l: "안정형" },
  { k: "aggressive", l: "공격형" },
  { k: "neutral", l: "중립" },
  { k: "undetermined", l: "성향 미정" },
];
const AXIS_LABEL: Record<string, string> = { reported_segment: "보고 부문", product: "제품", region: "지역" };
const TYPE_LABEL: Record<string, string> = { reported_fact: "공시 사실", derived_calculation: "계산", hypothesis: "가설(회사 전망)", observation: "관측", limitation: "한계", plan: "계획", hold: "보류 안내" };
const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const eok = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}억원`;
const jo = (v: number) => `${(v / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;

// ── 작은 Markdown 렌더러 (Agent 요약 구역 전용: 굵게·목록·문단) ──
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\[출처:[^\]]+\])/g).map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("[출처:") ? <small key={i} className="src">{p}</small> : <Fragment key={i}>{p}</Fragment>,
  );
}
export function Md({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("- ")) list.push(l.slice(2));
    else {
      flush();
      if (l.startsWith("### ") || l.startsWith("## ")) blocks.push(<h4 key={blocks.length}>{l.replace(/^#+ /, "")}</h4>);
      else blocks.push(<p key={blocks.length}>{inline(l)}</p>);
    }
  }
  flush();
  return <div className="md">{blocks}</div>;
}

function Spark({ values, w = 120, h = 28 }: { values: (number | null)[]; w?: number; h?: number }) {
  const pts = values.map((v, i) => (v == null ? null : { i, v })).filter(Boolean) as { i: number; v: number }[];
  if (pts.length < 2) return <span className="muted">—</span>;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="spark">
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
      <circle cx={x(pts.at(-1)!.i)} cy={y(pts.at(-1)!.v)} r="2.5" fill="var(--primary)" />
    </svg>
  );
}

function SourceBadge({ s }: { s: Common | null }) {
  if (!s) return null;
  return (
    <span className={`pill ${s.source.kind === "pc" ? "pill-violet" : "pill-gray"}`} title={s.source.run || s.source.notebook}>
      {s.source.label} · {s.agent} {s.codeVersion.replace(/^p0\d-agent-/, "v")}
    </span>
  );
}

function CriticalHolds({ items, title = "꼭 알아야 할 보류", blocking = 0 }: { items: Crit[]; title?: string; blocking?: number }) {
  if (!items.length && blocking > 0)
    return (
      <section className="card co-card">
        <h2><Lock size={16} aria-hidden /> {title}</h2>
        <p className="co-sub">
          <span className="pill pill-danger" style={{ height: 22, marginRight: 8 }}>차단 {blocking}건</span>
          차단 보류가 있지만 Agent가 대표 보류를 따로 뽑아 두지 않았습니다. 아래 "보류 등록부"에서 하나씩 확인하세요. 보류가 없는 결과가 아닙니다.
        </p>
      </section>
    );
  if (!items.length) return null;
  return (
    <section className="card co-card">
      <h2><Lock size={16} aria-hidden /> {title}</h2>
      <ol className="crit-list">
        {items.map((c, i) => (
          <li key={i}>
            <b>{c.problem}</b>
            {c.blocking && <span className="pill pill-danger" style={{ marginLeft: 8, height: 22 }}>차단</span>}
            {c.count && c.count > 1 ? <span className="muted"> · {c.count}건</span> : null}
            <p><span className="muted">제한되는 해석</span> {c.limit}</p>
            <p><span className="muted">해결 방법</span> {c.resolve}</p>
            {c.holdId && <small className="muted mono" style={{ overflowWrap: "anywhere" }}>{c.holdId}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Counts({ s }: { s: Common }) {
  const vpass = s.verifier.reduce((a, v) => a + v.pass, 0);
  const vfail = s.verifier.reduce((a, v) => a + v.fail, 0);
  const items = [
    { l: "주장", v: `${s.counts.claims}개`, d: `숨긴 주장 ${s.counts.suppressed}개` },
    { l: "보류", v: `${s.counts.holds}건`, d: `차단 ${s.counts.blocking}건` },
    ...(s.counts.evidence ? [{ l: "근거·산식", v: `${s.counts.evidence}·${s.counts.calculations}`, d: "원문 위치·재계산식" }] : []),
    { l: "Verifier", v: s.verifier.length ? `${vpass}건 통과` : "—", d: vfail ? `실패 ${vfail}건` : s.verifier.map((v) => v.check.split(" ")[0]).join("·") || "검사 기록" },
  ];
  return (
    <section className="card stat-strip co-counts">
      {items.map((x) => (
        <div key={x.l}>
          <small>{x.l}</small>
          <b className="num">{x.v}</b>
          <small className="muted">{x.d}</small>
        </div>
      ))}
    </section>
  );
}

// ── 목록 ─────────────────────────────────────────────
type Bundle = {
  bundledAt: string;
  finals: { p02: string; p04: string };
  agents: Record<"p02" | "p04", { companies: number; runs: { asOf: string[]; tickers: string[] }[] }>;
  note: string;
};
/** 단일 HTML에 묶어 넣은 Agent 결과의 기준. 서버 모드에서 결과 폴더를 바로 읽을 때는 나오지 않는다 */
function BundleNote() {
  const { data: b } = useFetch<Bundle | null>("/agents/bundle");
  if (!b) return null;
  const when = new Date(b.bundledAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p04AsOf = b.agents.p04.runs.map((r) => `${r.asOf.join("·")} ${r.tickers.length}개`).join(", ");
  return (
    <p className="muted bundle-note" style={{ fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.6 }}>
      <b>Agent 결과 기준:</b> {b.finals.p02} · {b.finals.p04} 수정 반영, 실행 폴더 P02 {b.agents.p02.runs.length}개 · P04 {b.agents.p04.runs.length}개, 묶은 시각 {when}.{" "}
      {b.note} P04 기준일은 {p04AsOf}입니다. 모두 <b>검증 전</b>(publication_eligible=false)이라 보류 이유와 함께 보여 줍니다.
    </p>
  );
}

export function CompanyList() {
  const { data } = useFetch<Company[]>("/companies");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("전체");
  const sectors = useMemo(() => ["전체", "Agent 분석", ...new Set((data ?? []).map((c) => c.sector))], [data]);
  const nq = q.replace(/\s/g, "").toLowerCase();
  const rows = (data ?? []).filter(
    (c) => (sector === "전체" || (sector === "Agent 분석" ? c.agent : c.sector === sector)) && (!nq || `${c.name}${c.ticker}`.toLowerCase().includes(nq)),
  );
  const agents = rows.filter((c) => c.agent);
  const others = rows.filter((c) => !c.agent);
  return (
    <>
      <PageMeta crumb="기업 분석" title="기업 분석" />
      <p className="muted" style={{ margin: "0 0 16px" }}>
        코스피 주요 <b>50개 기업</b>의 공시와 재무를 <b>OpenDART</b>에서 실시간으로 읽고, Agent를 돌린 기업은 <b>P02 사업 분석</b>·<b>P04 기술적 분석</b> 결과도 함께 봅니다. Agent 결과 폴더에 새 종목이 생기면 자동으로 붙습니다.
      </p>
      <DartFeed />
      <BundleNote />
      <div className="co-filter">
        <label className="co-find">
          <Search size={16} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업 이름이나 종목코드" aria-label="기업 찾기" />
        </label>
        <div className="co-chips" role="group" aria-label="업종">
          {sectors.map((s) => (
            <button key={s} aria-pressed={sector === s} onClick={() => setSector(s)}>{s}</button>
          ))}
        </div>
      </div>
      {agents.length > 0 && (
        <section className="grid-2" style={{ marginBottom: 16 }}>
          {agents.map((c) => (
            <Link key={c.ticker} to={c.href} className="card co-pick">
              <div className="row">
                <span className="etf-logo">{c.name.slice(0, 2)}</span>
                <div>
                  <h3>{c.name}</h3>
                  <small className="muted">{c.ticker} · {c.sector} · <span className="pill pill-violet">{[c.agents.p02 && "P02", c.agents.p04 && "P04"].filter(Boolean).join("·")} Agent</span></small>
                </div>
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
                <span>
                  <b className="num">{c.close ? won(c.close) : "—"}</b> <small className="muted">{c.asOf} 종가</small>
                </span>
                {c.phase && <span className="pill pill-gray">{c.phase.split("(")[0]}</span>}
              </div>
            </Link>
          ))}
        </section>
      )}
      <section className="co-all" aria-label="기업 목록">
        {others.map((c) => (
          <Link key={c.ticker} to={c.href} className="card co-mini">
            <span className="etf-logo">{c.name.slice(0, 2)}</span>
            <span>
              <b>{c.name}</b>
              <small className="muted">{c.ticker} · {c.sector}</small>
            </span>
          </Link>
        ))}
      </section>
      {data && !rows.length && <div className="empty-state">찾는 기업이 없습니다.</div>}
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        50개 목록은 2026년 기준 코스피 시가총액 상위권을 추정해 고른 것이라 실제 순위와 다를 수 있습니다. <span className="inf-tag">추론 INF-014</span> 학습용이며 투자 권유가 아닙니다.
      </p>
    </>
  );
}

// ── 상세 ─────────────────────────────────────────────
const AGENT_TABS = [
  { k: "business", l: "사업 분석 (P02)" },
  { k: "technical", l: "기술적 분석 (P04)" },
  { k: "report", l: "Agent 보고서" },
] as const;
const DART_TAB = { k: "dart", l: "공시·재무 (OpenDART)" } as const;

export function CompanyDetail() {
  const { ticker = "005930" } = useParams();
  const { data: list } = useFetch<Company[]>("/companies");
  const co = list?.find((c) => c.ticker === ticker);
  if (list && !co) return <div className="empty-state">기업을 찾을 수 없습니다. <Link to="/app/company">목록으로</Link></div>;
  if (!co) return <div className="card skeleton" style={{ height: 240 }} />;
  return co.agent ? <AgentCompany key={ticker} ticker={ticker} has={co.agents} /> : <DartCompany key={ticker} co={co} />;
}

function DartCompany({ co }: { co: Company }) {
  const nav = useNavigate();
  const panel = useMemo(
    () => ({
      title: "OpenDART",
      chip: <span className="ai-chip">실시간 공시</span>,
      body: (
        <>
          <div className="note-amber">
            <p>{co.name}은 Agent 분석 대상이 아니라서, 금융감독원 OpenDART의 공시 목록·기업개황·주요 재무를 그대로 보여 줍니다.</p>
            <small>숫자는 공시 원문을 억원으로 반올림한 값입니다.</small>
          </div>
          <span className="inf-tag" style={{ alignSelf: "flex-start" }}>추론 INF-015 · OpenDART 실시간 조회</span>
          <button className="btn btn-primary btn-block" onClick={() => nav(`/app/ask?q=${encodeURIComponent(`${co.name} 최근 공시 알려줘`)}`)}>이 기업 공시 질문하기</button>
        </>
      ),
    }),
    [co, nav],
  );
  return (
    <>
      <PageMeta crumb="기업 분석" title={co.name} panel={panel} />
      <div className="etf-head">
        <div className="etf-id">
          <span className="etf-logo">{co.name.slice(0, 2)}</span>
          <div>
            <h1>{co.name}</h1>
            <small>{co.ticker} · {co.market} · {co.sector} · OpenDART 공시 기반</small>
          </div>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected>{DART_TAB.l}</button>
      </div>
      <DartView ticker={co.ticker} />
    </>
  );
}

function AgentCompany({ ticker, has }: { ticker: string; has: { p02: boolean; p04: boolean } }) {
  const TABS = [...AGENT_TABS.filter((t) => (t.k === "business" ? has.p02 : t.k === "technical" ? has.p04 : true)), DART_TAB];
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.find((t) => t.k === sp.get("tab"))?.k ?? TABS[0].k) as (typeof TABS)[number]["k"];
  const setTab = (k: string) => setSp((p) => (p.set("tab", k), p), { replace: true });
  const { data: p02, error: e02 } = useFetch<P02>(has.p02 ? `/companies/${ticker}/p02` : null);
  const { data: p04, error: e04 } = useFetch<P04>(has.p04 ? `/companies/${ticker}/p04` : null);
  const error = e02 ?? e04;

  const close = p04?.observations.find((o) => o.id === "OBS_CLOSE");
  const last = p04?.prices?.last ?? [];
  const prev = last.length > 1 ? last[last.length - 2].close : null;
  const chg = close && prev ? ((close.value / prev - 1) * 100) : null;

  const panel = useMemo(
    () => ({
      title: "Agent 요약",
      chip: <span className="ai-chip">P02 · P04</span>,
      body: <AgentPanel p02={p02} p04={p04} />,
    }),
    [p02, p04],
  );

  if (error) return <div className="empty-state">{error} <Link to="/app/company">목록으로</Link></div>;
  const name = p02?.name ?? p04?.name ?? "";

  return (
    <>
      <PageMeta crumb="기업 분석" title={name} panel={panel} />
      <div className="etf-head">
        <div className="etf-id">
          <span className="etf-logo">{name.slice(0, 2)}</span>
          <div>
            <h1>{name || "…"}</h1>
            <small>{ticker} · 코스피 · 실제 공시·시세 기반 Agent 결과</small>
          </div>
        </div>
        {close && (
          <div className="price">
            <b className="num">{won(close.value)}</b>
            {chg != null && <span className={`chg ${chg >= 0 ? "up" : "down"}`}>{chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%</span>}
            <small className="muted" style={{ display: "block" }}>{p04?.asOf} 종가 · {p04?.prices?.source ?? "Neon core.price_daily"}</small>
          </div>
        )}
      </div>

      {tab !== "dart" && (
        <div className="co-warn" role="note">
          <AlertTriangle size={16} aria-hidden />
          <span>
            <b>검증 전 결과</b>입니다. Agent 결과는 발행 적격이 아니며(publication_eligible=false), 보류된 내용은 결론에 쓰지 않습니다. 연구 도구 결과이며 투자 권유가 아닙니다.
          </span>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {tab === "business" && (p02 ? <Business s={p02} /> : <div className="card skeleton" style={{ height: 240 }} />)}
      {tab === "technical" && (p04 ? <Technical s={p04} /> : <div className="card skeleton" style={{ height: 240 }} />)}
      {tab === "report" && <ReportView ticker={ticker} p02={p02} p04={p04} has={has} />}
      {tab === "dart" && <DartView ticker={ticker} />}
    </>
  );
}

function AgentPanel({ p02, p04 }: { p02: P02 | null; p04: P04 | null }) {
  const nav = useNavigate();
  const latestSeg = p02?.segments.reported_segment;
  const lastIdx = latestSeg ? latestSeg.periods.length - 1 : -1;
  const ds = latestSeg?.rows.find((r) => !r.name.startsWith("[") && !r.hiddenAt?.[lastIdx]);
  const total = latestSeg?.rows.find((r) => r.name.startsWith("[연결]"));
  const rev = p02?.companyRevenue.at(-1);
  const obs = (id: string) => p04?.observations.find((o) => o.id === id);
  return (
    <>
      <div className="note-amber">
        {p02 && (
          <p>
            <b>사업(P02)</b> ·{" "}
            {ds && total && lastIdx >= 0
              ? `${latestSeg!.periods[lastIdx]} ${ds.name} ${p02!.revenueItem}은 ${eok(ds.values[lastIdx]!)}, 연결 ${p02!.revenueItem}은 ${eok(total.values[lastIdx]!)}입니다.`
              : rev
                ? `${rev.period} 회사 전체 연결 매출은 ${eok(rev.won / 1e8)}입니다(단일 영업부문).`
                : "사업부 분기표가 없습니다."}
          </p>
        )}
        {p04 && (
          <p>
            <b>시세(P04)</b> · {p04.phase ? `현재 ${p04.phase}` : ""}. RSI(14) {obs("OBS_RSI14")?.value}, 지난 20거래일 실현변동성 {obs("OBS_RV20_PAST_PCT")?.value}%, 최근 1년 최대낙폭 {obs("OBS_MDD_1Y")?.value}%.
          </p>
        )}
        <small>예측은 자료 계약 확인 전이라 보류 상태입니다. 숫자는 Agent 원문 그대로입니다.</small>
      </div>
      <div className="tiles">
        <div className="tile"><b>{p02 ? p02.counts.claims + (p04?.counts.claims ?? 0) : "…"}</b><small>확인된 주장</small></div>
        <div className="tile"><b>{p02 ? p02.counts.holds + (p04?.counts.holds ?? 0) : "…"}</b><small>보류</small></div>
        <div className="tile"><b>{p04?.forecasts.filter((f) => f.status === "held").length ?? "…"}</b><small>보류된 예측</small></div>
      </div>
      <span className="inf-tag" style={{ alignSelf: "flex-start" }}>추론 INF-012 · 저장된 Agent 결과 읽기</span>
      <button className="btn btn-primary btn-block" onClick={() => nav(`/app/ask?q=${encodeURIComponent(`${p02?.name ?? ""} 사업 구성은 어떻게 돼?`)}`)}>이 기업에 대해 질문하기</button>
    </>
  );
}

// ── 사업 분석 (P02) ──────────────────────────────────
function Business({ s }: { s: P02 }) {
  const axes = Object.keys(s.segments).sort((a, b) => (a === "reported_segment" ? -1 : b === "reported_segment" ? 1 : a.localeCompare(b)));
  const [axis, setAxis] = useState(axes[0] ?? "");
  const seg = s.segments[axis];
  const [q, setQ] = useState("");
  const [qr, setQr] = useState<{ query: string; found: boolean; matches: { axis: string; name: string; period: string; eok: number }[]; holds: string[] } | null>(null);
  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setQr(await api(`/companies/${s.ticker}/p02/query?q=${encodeURIComponent(q.trim())}`));
  };
  const rev = s.companyRevenue;
  const maxRev = Math.max(1, ...rev.map((r) => r.won));

  return (
    <div className="co-grid">
      <Meta s={s} />
      <Counts s={s} />

      {seg && (
        <section className="card co-card">
          <div className="head">
            <h2>사업부별 분기 {s.revenueItem} <small className="muted">억원 · 단독분기</small></h2>
            {axes.length > 1 && (
              <div className="seg" role="group" aria-label="사업 축">
                {axes.map((a) => <button key={a} aria-pressed={axis === a} onClick={() => setAxis(a)}>{AXIS_LABEL[a] ?? a}</button>)}
              </div>
            )}
          </div>
          <div className="co-scroll">
            <table className="table co-seg">
              <thead>
                <tr>
                  <th>사업</th>
                  <th>추이</th>
                  {seg.periods.slice(-4).map((p) => <th key={p} className="num">{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {seg.rows.map((r) => {
                  const sub = r.name.startsWith("[");
                  const off = seg.periods.length - 4;
                  return (
                    <tr key={r.name} className={sub ? "sub" : ""}>
                      <td>{r.name.replace(/^\[[^\]]+\]\s*/, "")}{sub && <small className="muted"> {r.name.match(/^\[([^\]]+)\]/)?.[1]}</small>}{r.hidden && <small className="muted"> 숨김(차단 보류)</small>}</td>
                      <td>{sub || r.hidden ? null : <Spark values={r.values} />}</td>
                      {r.values.slice(-4).map((v, i) => (
                        <td key={i} className="num">
                          {v == null ? <span className="muted">—</span> : v.toLocaleString("ko-KR")}
                          {r.q4Derived[off + i] && <sup title="누적 − 앞 기간 누적 (4분기 = 연간 − 3분기 누적)">*</sup>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {s.revenueItem !== "매출" && <small className="muted">이 숫자는 공시 표의 '{s.revenueItem}'이며 회사 전체 수익(수수료수익 등)과 다릅니다.</small>}
          {seg.rows.some((r) => r.hidden) && <small className="muted">숨김(차단 보류) 행은 단독 주장에서 뺀 원문 값으로, 합계가 맞는지 보이려고 함께 적었습니다.</small>}
          <small className="muted">* 누적에서 앞 기간 누적을 빼서 계산한 단독분기(4분기 = 연간 − 3분기 누적). 빈 칸(—)은 그 기간에 해당 사업이 공시되지 않았거나 정의가 달라 비교하지 않은 칸입니다. 전체 {seg.periods[0]}~{seg.periods.at(-1)}.</small>
        </section>
      )}

      {rev.length > 0 && (
        <section className="card co-card">
          <h2>회사 전체 연결 매출 <small className="muted">DART 재무제표 API</small></h2>
          <div className="co-bars" role="img" aria-label={`${s.name} 분기 연결 매출 막대 그래프`}>
            {rev.map((r) => (
              <div key={r.period} className="bar" title={`${r.period} ${eok(r.won / 1e8)} · ${r.method} · 접수번호 ${r.rcept}`}>
                <i style={{ height: `${(r.won / maxRev) * 100}%` }} data-q4={r.period.endsWith("Q4")} />
                <small>{r.period.endsWith("Q1") ? r.period.slice(2, 4) : ""}</small>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <small className="muted">{rev[0].period} {jo(rev[0].won / 1e8)}원</small>
            <small><b>{rev.at(-1)!.period} {jo(rev.at(-1)!.won / 1e8)}원</b></small>
          </div>
          {!s.segments.reported_segment && <small className="muted">단일 영업부문 회사라 사업부 매출 = 회사 전체 연결 매출입니다. 제품별(DRAM/NAND) 금액은 이 결과에 없습니다.</small>}
        </section>
      )}

      <section className="card co-card">
        <h2><Search size={16} aria-hidden /> 사업 질의</h2>
        <p className="muted" style={{ margin: 0 }}>공시된 사업 단위에서만 찾습니다. 공시에 없는 항목(예: HBM)은 상위 사업 매출로 대신 답하지 않습니다.</p>
        <form className="co-query" onSubmit={ask}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: DS, 메모리, HBM, 미주" aria-label="사업 이름" />
          <button className="btn btn-dark">찾기</button>
        </form>
        {qr && (
          <div className={`co-qr ${qr.found ? "ok" : "held"}`}>
            {qr.found
              ? qr.matches.map((m) => <p key={m.axis + m.name}><b>{m.name}</b> <small className="muted">{AXIS_LABEL[m.axis] ?? m.axis}</small> · {m.period} {eok(m.eok)}</p>)
              : qr.holds.map((h) => <p key={h}><span className="pill pill-amber" style={{ height: 22 }}>보류</span> <span className="mono">{h.split(":")[0]}</span>{h.slice(h.indexOf(":"))}</p>)}
            <span className="inf-tag">추론 INF-013 · P02 ask() 규칙 재현</span>
          </div>
        )}
      </section>

      <CriticalHolds items={s.criticalHolds} blocking={s.counts.blocking} />
    </div>
  );
}

function Meta({ s }: { s: Common }) {
  return (
    <div className="co-meta">
      <SourceBadge s={s} />
      <span className="mono">{s.reportId}</span>
      <span>기준일 {s.asOf}</span>
      <span>자료 모드 {s.dataMode}</span>
      {"status" in s && <span>상태 {(s as P04).status}</span>}
      <span className="pill pill-amber" style={{ height: 22 }}>발행 부적격</span>
    </div>
  );
}

// ── 기술적 분석 (P04) ────────────────────────────────
const OBS_GROUPS = [
  { t: "가격과 추세", ids: ["OBS_CLOSE", "OBS_MA20", "OBS_MA60", "OBS_MA120", "OBS_CLOSE_VS_MA20", "OBS_CLOSE_VS_MA60", "OBS_CLOSE_VS_MA120"] },
  { t: "모멘텀", ids: ["OBS_RSI14", "OBS_RETURN_20D", "OBS_RETURN_60D", "OBS_VOLUME_VS_20D"] },
  { t: "변동성과 낙폭", ids: ["OBS_RV5_PAST_PCT", "OBS_RV20_PAST_PCT", "OBS_VOL20_ANNUAL_STD", "OBS_MDD_1Y", "OBS_RV5_PAST", "OBS_RV20_PAST"] },
];
const FC_LABEL: Record<string, string> = { RV5: "5거래일 변동성 예측", RV20: "20거래일 변동성 예측", D5_5: "5거래일 안 −5% 하락 확률", D20_10: "20거래일 안 −10% 하락 확률" };

function fmtObs(o: Obs) {
  if (o.unit === "원") return won(o.value);
  if (o.unit === "%") return `${o.value > 0 && !/RV|VOL/.test(o.id) ? "+" : ""}${o.value}%`;
  if (o.unit === "배") return `${o.value}배`;
  return String(o.value);
}

function Technical({ s }: { s: P04 }) {
  const by = new Map(s.observations.map((o) => [o.id, o]));
  const rest = s.observations.filter((o) => !OBS_GROUPS.some((g) => g.ids.includes(o.id)));
  const groups = [...OBS_GROUPS, ...(rest.length ? [{ t: "기타", ids: rest.map((o) => o.id) }] : [])];
  const rsi = by.get("OBS_RSI14")?.value;
  return (
    <div className="co-grid">
      <Meta s={s} />
      <section className="card co-card">
        <div className="head">
          <h2>관측 지표 <small className="muted">과거 사실 · 표시 "미확인"</small></h2>
          {s.phase && <span className="pill pill-violet">국면: {s.phase}</span>}
        </div>
        {rsi != null && (
          <div className="co-rsi" aria-label={`RSI ${rsi}`}>
            <div className="track"><i style={{ left: `${rsi}%` }} /><span style={{ left: "30%" }} /><span style={{ left: "70%" }} /></div>
            <div className="row" style={{ justifyContent: "space-between" }}><small className="muted">0 · 과매도 30</small><small><b>RSI(14) {rsi}</b></small><small className="muted">과매수 70 · 100</small></div>
          </div>
        )}
        {groups.map((g) => (
          <Fragment key={g.t}>
            <h3 className="co-sub">{g.t}</h3>
            <div className="co-obs">
              {g.ids.map((id) => by.get(id)).filter(Boolean).map((o) => (
                <div key={o!.id} className="o" title={`${o!.formula}\n${o!.window}`}>
                  <small>{o!.label}</small>
                  <b className={`num ${o!.unit === "%" && !/RV|VOL/.test(o!.id) ? (o!.value >= 0 ? "up" : "down") : ""}`}>{fmtObs(o!)}</b>
                  <small className="muted mono">{o!.formula}</small>
                  {o!.display === "미확인" && <span className="unv">미확인</span>}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
        <small className="muted">미확인: 숫자는 정확히 계산됐지만, 수정주가·거래 상태·거래일 달력 같은 자료 계약을 사람이 아직 확인하지 않았다는 뜻입니다.</small>
      </section>

      {s.prices && s.prices.last.length > 0 && (
        <section className="card co-card">
          <h2>최근 시세 <small className="muted">{s.prices.source} · {s.prices.rows.toLocaleString("ko-KR")}행 {s.prices.range} · 조정 {s.prices.adjustment}</small></h2>
          <div className="co-scroll">
            <table className="table">
              <thead><tr><th>날짜</th><th className="num">시가</th><th className="num">고가</th><th className="num">저가</th><th className="num">종가</th><th className="num">거래량</th></tr></thead>
              <tbody>
                {s.prices.last.map((p) => (
                  <tr key={p.date}><td>{p.date}</td><td className="num">{p.open.toLocaleString("ko-KR")}</td><td className="num">{p.high.toLocaleString("ko-KR")}</td><td className="num">{p.low.toLocaleString("ko-KR")}</td><td className="num"><b>{p.close.toLocaleString("ko-KR")}</b></td><td className="num">{p.volume.toLocaleString("ko-KR")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card co-card">
        <h2>예측 <small className="muted">계약 확인 전까지 내지 않음</small></h2>
        <div className="co-fc">
          {s.forecasts.map((f) => (
            <div key={f.item} className="f">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{FC_LABEL[f.item] ?? f.item}</b>
                <span className="pill pill-amber" style={{ height: 22 }}>{f.status === "held" ? "보류" : f.status}</span>
              </div>
              <small className="muted mono">{f.holds.join(" · ")}</small>
            </div>
          ))}
        </div>
        <small className="muted">시장노트의 ETF 6개월 예측 밴드(통계 모델)와 달리, P04는 자료 계약이 확인되기 전에는 예측 숫자를 만들지 않습니다.</small>
      </section>

      {s.holdActions && s.holdActions.length > 0 && (
        <section className="card co-card">
          <h2><ShieldCheck size={16} aria-hidden /> 예측을 풀려면 <small className="muted">보류 코드별 다음 행동</small></h2>
          <div className="co-scroll">
            <table className="table">
              <tbody>
                {s.holdActions.map((h) => (
                  <tr key={h.code}><td><span className="mono">{h.code}</span><br /><small className="muted">{h.cause}</small></td><td>{h.next}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {s.askExample && (
        <section className="card co-card">
          <h2>Agent 자유 질의 예시 <small className="muted">{s.askExample.persona}</small></h2>
          <div className="q-bubble" style={{ alignSelf: "flex-end" }}>{s.askExample.question}</div>
          <p style={{ margin: 0, lineHeight: 1.75 }}>{s.askExample.answer}</p>
          <small className="muted">노트북 [12-3]의 agent.ask() 출력 그대로입니다. 새 질문은 PC에서 Agent를 실행해야 합니다.</small>
        </section>
      )}

      <Counts s={s} />
      <CriticalHolds items={s.criticalHolds} blocking={s.counts.blocking} />
    </div>
  );
}

// ── Agent 보고서 (페르소나) ──────────────────────────
function ReportView({ ticker, p02, p04, has }: { ticker: string; p02: P02 | null; p04: P04 | null; has: { p02: boolean; p04: boolean } }) {
  const [agent, setAgent] = useState<"p02" | "p04">(has.p04 ? "p04" : "p02");
  const sum = agent === "p02" ? p02 : p04;
  const avail = new Set(sum?.personas.map((p) => p.key) ?? []);
  const [level, setLevel] = useState("L2");
  const [style, setStyle] = useState("conservative");
  const { data: r, error } = useFetch<Report>(`/companies/${ticker}/${agent}/report?level=${level}&style=${style}`);
  const [showClaims, setShowClaims] = useState(false);
  const [showHolds, setShowHolds] = useState(false);
  const [filter, setFilter] = useState("all");
  const types = [...new Set(r?.claims.map((c) => c.type) ?? [])];
  const claims = (r?.claims ?? []).filter((c) => filter === "all" || c.type === filter);
  const summaryOnly = r?.substituted && agent === "p02" ? p02?.summaries?.[`${level}_${style}`] : undefined;

  return (
    <div className="co-grid">
      <section className="card co-card co-persona">
        <div className="seg" role="group" aria-label="Agent">
          {has.p04 && <button aria-pressed={agent === "p04"} onClick={() => setAgent("p04")}>기술적 분석 P04</button>}
          {has.p02 && <button aria-pressed={agent === "p02"} onClick={() => setAgent("p02")}>사업 분석 P02</button>}
        </div>
        <div className="row wrap">
          <span className="muted lbl">설명 수준</span>
          <div className="seg" role="group" aria-label="설명 수준">
            {LEVELS.map((l) => <button key={l.k} aria-pressed={level === l.k} onClick={() => setLevel(l.k)}>{l.l}</button>)}
          </div>
        </div>
        <div className="row wrap">
          <span className="muted lbl">투자 성향</span>
          <div className="seg" role="group" aria-label="투자 성향">
            {STYLES.map((s) => (
              <button key={s.k} aria-pressed={style === s.k} onClick={() => setStyle(s.k)} className={avail.has(`${level}_${s.k}`) ? "" : "dim"}>{s.l}</button>
            ))}
          </div>
        </div>
        <small className="muted">
          같은 숫자·근거·보류를 수준과 성향에 맞춰 다르게 설명할 뿐, 결과는 바뀌지 않습니다(Agent 12조합 보존 검사 통과).
          {sum?.source.kind === "snapshot" && " 지금은 노트북 스냅샷이라 일부 조합만 있습니다. PC 결과 폴더를 연결하면 16조합이 모두 열립니다."}
        </small>
      </section>

      {error && <div className="empty-state">{error}</div>}
      {r && (
        <>
          {r.substituted && (
            <div className="co-warn" role="note">
              <FileText size={16} aria-hidden />
              <span>
                {LEVELS.find((l) => l.k === r.requested.level)?.l} · {STYLES.find((s) => s.k === r.requested.style)?.l} 보고서가 없어 <b>{LEVELS.find((l) => l.k === r.level)?.l} · {STYLES.find((s) => s.k === r.style)?.l}</b> 보고서를 보여 줍니다.
              </span>
            </div>
          )}
          <section className="card co-card co-report">
            <h2>{r.title}</h2>
            <div className="co-meta">
              {Object.entries(r.meta).map(([k, v]) => <span key={k}><span className="muted">{k}</span> {v}</span>)}
              <span><span className="muted">persona_id</span> {r.personaId}</span>
            </div>
            {r.intro.map((p) => <p key={p} className="lead">{p}</p>)}
            {r.scope.length > 0 && (
              <>
                <h3 className="co-sub">이 결과가 다루는 범위</h3>
                <ul>{r.scope.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            )}
            {summaryOnly && (
              <div className="co-alt">
                <b>{level} · 중립 요약 (노트북 [10-2])</b>
                <Md text={summaryOnly} />
              </div>
            )}
            <h3 className="co-sub">요약</h3>
            <Md text={r.summary} />
            {r.readingOrder.length > 0 && (
              <div className="row wrap" style={{ gap: 8 }}>
                <span className="muted lbl">읽는 순서</span>
                {r.readingOrder.map((x, i) => <span key={x} className="pill pill-gray">{i + 1}. {x}</span>)}
              </div>
            )}
          </section>

          <CriticalHolds items={r.critical} title="꼭 알아야 할 보류 (모든 수준 동일)" />

          {r.questions.length > 0 && (
            <section className="card co-card">
              <h2>확인할 질문</h2>
              <ul className="co-q">{r.questions.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          )}

          <section className="card co-card">
            <button className="co-fold" aria-expanded={showClaims} onClick={() => setShowClaims((v) => !v)}>
              확인된 주장 {r.claims.length}개 <span className="muted">원 분석 문장과 출처 그대로</span>
            </button>
            {showClaims && (
              <>
                <div className="seg" role="group" aria-label="주장 종류" style={{ flexWrap: "wrap" }}>
                  <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체</button>
                  {types.map((t) => <button key={t} aria-pressed={filter === t} onClick={() => setFilter(t)}>{TYPE_LABEL[t] ?? t}</button>)}
                </div>
                <ul className="co-claims">
                  {claims.slice(0, 120).map((c) => (
                    <li key={c.id}>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <span className="mono muted">{c.id}</span>
                        <span className={`pill ${c.type === "hypothesis" ? "pill-amber" : "pill-gray"}`} style={{ height: 20, fontSize: 11 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                        <small className="muted">{c.status}</small>
                      </div>
                      <p>{c.text}</p>
                      <small className="src">{c.source}</small>
                    </li>
                  ))}
                </ul>
                {claims.length > 120 && <small className="muted">처음 120개만 보여 줍니다.</small>}
              </>
            )}
          </section>

          <section className="card co-card">
            <button className="co-fold" aria-expanded={showHolds} onClick={() => setShowHolds((v) => !v)}>
              보류 등록부 {r.holds.length}건 <span className="muted">차단 {r.holds.filter((h) => h.blocking).length}건</span>
            </button>
            {showHolds && (
              <div className="co-scroll">
                <table className="table">
                  <thead><tr><th>보류 ID</th><th>원인</th><th>필요한 것</th><th>차단</th></tr></thead>
                  <tbody>
                    {r.holds.map((h) => (
                      <tr key={h.id}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{h.id}</td>
                        <td>{h.cause}<br /><small className="muted mono">{h.code}</small></td>
                        <td>{h.detail}</td>
                        <td>{h.blocking ? <span className="pill pill-danger" style={{ height: 22 }}>차단</span> : <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.limits.length > 0 && (
              <>
                <h3 className="co-sub">가정과 한계</h3>
                <ul className="co-limits">{r.limits.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
