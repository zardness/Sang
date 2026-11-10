import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Sparkles } from "lucide-react";
import { PageMeta, useShell } from "../components/Shell";
import LineChart from "../components/LineChart";
import Change from "../components/Change";
import { useFetch } from "../lib/useFetch";
import type { Briefing, Point, Quote } from "../lib/api";
import { fmt, fmtPrice } from "../lib/format";

const RANGES = [
  { k: "1w", l: "1주" },
  { k: "1m", l: "1개월" },
  { k: "1y", l: "1년" },
  { k: "5y", l: "5년" },
];

export default function Dashboard() {
  const { data } = useFetch<{ headline: string; subline: string; briefings: Briefing[]; quotes: Quote[] }>("/dashboard");
  const [code, setCode] = useState("KOSPI");
  const [range, setRange] = useState("1y");
  const { data: s } = useFetch<{ points: Point[] }>(`/market/${code}/series?range=${range}`);
  const { setAiOpen } = useShell();
  const { data: cos } = useFetch<{ ticker: string; name: string; close: number | null; asOf: string; phase: string; href: string; agent: boolean }[]>("/companies");
  const q = data?.quotes.find((x) => x.code === code);
  const others = (data?.quotes ?? []).filter((x) => x.code !== code);

  const panel = useMemo(
    () => ({
      title: "Agent 브리핑",
      body: (
        <div className="brief-list">
          {(data?.briefings ?? []).map((b) => (
            <Link key={b.title} to={b.link} className="brief">
              <span className="k">{b.kind}</span>
              <b>{b.title}</b>
              <p>{b.body}</p>
            </Link>
          ))}
          <span className="inf-tag" style={{ alignSelf: "flex-start" }}>추론 INF-011 · 규칙 기반 브리핑</span>
        </div>
      ),
    }),
    [data],
  );

  return (
    <>
      <PageMeta crumb="홈" title="대시보드" panel={panel} />
      <div className="page-head">
        <div>
          <h1>{data?.headline ?? " "}</h1>
          <p>{data?.subline}</p>
        </div>
        <button className="pill pill-amber" onClick={() => setAiOpen(true)}>
          <Sparkles size={12} /> Agent 브리핑 {data?.briefings.length ?? 0}건
        </button>
      </div>

      <section className="card big-chart">
        <div className="head">
          <div>
            <div className="label">{q?.name ?? ""} {q?.kind === "index" ? "지수" : ""}</div>
            {q ? (
              <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="big-num num">{fmtPrice(q.last, q.unit)}</span>
                <span className="chg"><Change value={q.changePct} abs={fmt(Math.abs(q.change))} /></span>
              </div>
            ) : (
              <div className="skeleton" style={{ height: 52, width: 300 }} />
            )}
          </div>
          <div className="seg" role="group" aria-label="기간">
            {RANGES.map((r) => (
              <button key={r.k} aria-pressed={range === r.k} onClick={() => setRange(r.k)}>{r.l}</button>
            ))}
          </div>
        </div>
        <LineChart points={s?.points ?? []} height={320} format={(v) => fmt(v)} ariaLabel={`${q?.name ?? ""} ${range} 차트`} />
      </section>

      <div className="kpis">
        {others.map((o) => (
          <button key={o.code} className="card kpi" onClick={() => setCode(o.code)} aria-pressed={false}>
            <small>{o.name}</small>
            <b className="num">{fmtPrice(o.last, o.unit)}</b>
            <Change value={o.changePct} />
          </button>
        ))}
      </div>

      <section className="dash-agents">
        <div className="row-head">
          <h2><Building2 size={18} aria-hidden /> Agent 기업 분석</h2>
          <Link to="/app/company" className="muted">전체 보기 →</Link>
        </div>
        <div className="grid-2">
          {(cos ?? []).filter((c) => c.agent).map((c) => (
            <Link key={c.ticker} to={c.href} className="card dash-co">
              <span className="etf-logo">{c.name.slice(0, 2)}</span>
              <div>
                <b>{c.name}</b> <small className="muted">{c.ticker}</small>
                <p>{c.close ? `${c.close.toLocaleString("ko-KR")}원` : "—"} <small className="muted">{c.asOf} 종가</small></p>
                <small className="muted">P04 국면: {c.phase || "—"} · P02 사업 분석 · 검증 전</small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
