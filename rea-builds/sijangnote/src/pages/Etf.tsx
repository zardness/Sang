import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { PageMeta } from "../components/Shell";
import LineChart from "../components/LineChart";
import Change from "../components/Change";
import { useFetch } from "../lib/useFetch";
import { api, Point, post, Quote } from "../lib/api";
import { fmtPrice } from "../lib/format";

type EtfRow = Quote & { category: string; ter: number; aum: string };
type Detail = Quote & {
  category: string;
  stats: { label: string; value: string; term?: string }[];
  holdings: number;
  top: { name: string; weight: number }[];
  overseas: boolean;
  related: { id: string; ord: number; title: string }[];
  news: { title: string; source: string; date: string }[];
};
type Forecast = { model: string; modelNote: string; points: { date: string; median: number; lo: number; hi: number }[] };
type Agent = { summary: string[]; evidence: string; tiles: { label: string; value: string; detail: string }[] };

export function EtfList() {
  const { data } = useFetch<EtfRow[]>("/etfs");
  const nav = useNavigate();
  return (
    <>
      <PageMeta crumb="종목·ETF" title="ETF 둘러보기" />
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>이름</th><th>분류</th><th>현재가</th><th>등락</th><th>총보수</th><th>순자산</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.code} className="link" onClick={() => nav(`/app/etf/${r.code}`)}>
                <td><Link to={`/app/etf/${r.code}`}><b>{r.name}</b></Link></td>
                <td className="muted">{r.category}</td>
                <td className="num">{fmtPrice(r.last, r.unit)}</td>
                <td><Change value={r.changePct} /></td>
                <td className="num">{r.ter}%</td>
                <td>{r.aum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>모든 종목은 가상 예시이며 수치는 예시 데이터입니다.</p>
    </>
  );
}

const TABS = ["차트", "종목 정보", "구성 종목", "뉴스", "관련 학습"] as const;
const RANGES = [
  { k: "1m", l: "1개월" },
  { k: "1y", l: "1년" },
  { k: "5y", l: "5년" },
  { k: "all", l: "전체" },
];

export function EtfDetail() {
  const { code = "SNP500" } = useParams();
  const { data: d, error } = useFetch<Detail>(`/etfs/${code}`);
  const [tab, setTab] = useState<(typeof TABS)[number]>("차트");
  const [range, setRange] = useState("5y");
  const { data: s } = useFetch<{ points: Point[] }>(`/market/${code}/series?range=${range}`);
  const { data: f } = useFetch<Forecast>(`/etfs/${code}/forecast`);
  const { data: agent } = useFetch<Agent>(`/etfs/${code}/agent`);
  const { data: watch, reload: reloadWatch } = useFetch<Quote[]>("/watchlist");
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const nav = useNavigate();

  const watching = !!watch?.some((w) => w.code === d?.code);
  const toggleWatch = async () => {
    if (!d) return;
    await api(`/watchlist/${d.code}`, { method: watching ? "DELETE" : "POST" });
    reloadWatch();
  };

  const makeReport = async () => {
    if (!d || !agent) return;
    const text = [
      `${d.name} 정리 리포트`,
      ...agent.summary,
      ...d.stats.map((x) => `${x.label}는 ${x.value}이다.`),
      `구성 종목은 ${d.holdings}개로 분산 투자 효과가 있다.`,
      `따라서 장기 적립식으로 보유하는 것을 기대 시나리오로 삼는다.`,
    ].join("\n");
    try {
      const r = await post<{ id: number }>("/reports", { title: `${d.name} 정리 리포트`, text });
      setReportMsg("리포트를 만들고 평가했어요.");
      nav(`/app/reports?id=${r.id}`);
    } catch (e) {
      setReportMsg((e as Error).message);
    }
  };

  const panel = useMemo(
    () => ({
      title: "Agent 분석",
      body: (
        <>
          <div className="note-amber">
            {agent ? agent.summary.map((p) => <p key={p}>{p}</p>) : <p className="skeleton" style={{ height: 80 }} />}
            <small>{agent?.evidence}</small>
          </div>
          <div className="tiles">
            {(agent?.tiles ?? []).map((t) => (
              <div className="tile" key={t.label} title={t.detail}>
                <b>{t.value}</b>
                <small>{t.label}</small>
              </div>
            ))}
          </div>
          <span className="inf-tag" style={{ alignSelf: "flex-start" }}>추론 INF-004 · 규칙 기반 등급</span>
          <button className="btn btn-primary btn-block" onClick={makeReport}>최종 정리 리포트 만들기</button>
          {reportMsg && <small className="muted">{reportMsg}</small>}
          <div className="sep" />
          <b style={{ fontSize: 14 }}>관심 종목</b>
          <div>
            {(watch ?? []).map((w) => (
              <Link to={`/app/etf/${w.code}`} className="watch-row" key={w.code}>
                <span className="flag">{w.region}</span>
                <span className="n">{w.name}</span>
                <Change value={w.changePct} digits={1} />
              </Link>
            ))}
          </div>
        </>
      ),
    }),
    [agent, watch, reportMsg, d], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (error) return <div className="empty-state">{error} <Link to="/app/etf">목록으로</Link></div>;

  return (
    <>
      <PageMeta crumb={`종목·ETF / ${d?.category ?? ""}`} title={d?.name ?? ""} panel={panel} />
      <div className="etf-head">
        <div className="etf-id">
          <span className="etf-logo">{d?.code === "SNP500" ? "S&P" : d?.code.slice(0, 3)}</span>
          <div>
            <h1>{d?.name ?? "…"}</h1>
            <small>가상 예시 종목 · {d?.overseas ? "해외 ETF" : "국내 ETF"}</small>
          </div>
          <button className="icon-btn" onClick={toggleWatch} aria-pressed={watching} aria-label={watching ? "관심 종목에서 빼기" : "관심 종목에 추가"}>
            <Star size={18} fill={watching ? "#f5b544" : "none"} color={watching ? "#f5b544" : "currentColor"} />
          </button>
        </div>
        {d && (
          <div className="price">
            <b className="num">{fmtPrice(d.last, d.unit)}</b>
            <Change value={d.changePct} abs={`${Math.abs(d.change).toLocaleString("ko-KR")}원`} />
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "차트" && (
        <>
          <section className="card chart-card">
            <div className="head">
              <h2>가격과 시장 동향 예측</h2>
              <div className="seg" role="group" aria-label="기간">
                {RANGES.map((r) => (
                  <button key={r.k} aria-pressed={range === r.k} onClick={() => setRange(r.k)}>{r.l}</button>
                ))}
              </div>
            </div>
            <LineChart
              points={s?.points ?? []}
              forecast={f?.points}
              area={false}
              color="var(--navy-900)"
              height={380}
              xLabels={range === "5y" || range === "all"}
              format={(v) => `${Math.round(v).toLocaleString("ko-KR")}원`}
              forecastLabel="6개월 예측 (통계 모델)"
              ariaLabel={`${d?.name ?? ""} 가격과 6개월 예측`}
            />
            <div className="legend">
              <span><i style={{ width: 18, height: 2, background: "var(--navy-900)" }} />실제 가격</span>
              <span><i style={{ width: 18, borderTop: "2px dashed var(--primary)" }} />예측 중앙값</span>
              <span><i style={{ width: 14, height: 10, background: "rgba(91,77,245,.15)" }} />예측 범위 (10~90%)</span>
              <span className="inf-tag" title={f?.modelNote}>추론 INF-003 · {f?.model}</span>
            </div>
          </section>
          <StatStrip d={d} />
        </>
      )}

      {tab === "종목 정보" && (
        <section className="card" style={{ padding: 24 }}>
          <table className="table">
            <tbody>
              <tr><td className="muted">분류</td><td>{d?.category}</td></tr>
              {d?.stats.map((x) => (
                <tr key={x.label}><td className="muted">{x.label}</td><td>{x.value}{x.term && <Link to={`/app/ask?q=${encodeURIComponent(x.term + "가 뭐야?")}`} className="muted" style={{ marginLeft: 8, fontSize: 12 }}>용어 풀이 →</Link>}</td></tr>
              ))}
              <tr><td className="muted">구성 종목 수</td><td>{d?.holdings}개</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {tab === "구성 종목" && (
        <section className="card" style={{ padding: 8 }}>
          <table className="table">
            <thead><tr><th>상위 종목 (가상)</th><th>비중</th><th /></tr></thead>
            <tbody>
              {d?.top.map((t) => (
                <tr key={t.name}><td>{t.name}</td><td className="num">{t.weight}%</td><td><div className="bar-mini"><i style={{ width: `${(t.weight / 25) * 100}%` }} /></div></td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "뉴스" && (
        <section className="card" style={{ padding: 8 }}>
          <table className="table"><tbody>
            {d?.news.map((n) => (<tr key={n.title}><td><b>{n.title}</b><br /><small className="muted">{n.source} · {n.date}</small></td></tr>))}
          </tbody></table>
        </section>
      )}

      {tab === "관련 학습" && (
        <section className="grid-2">
          {d?.related.map((r) => (
            <Link key={r.id} to={`/app/learn/${r.id}`} className="card" style={{ padding: 22 }}>
              <span className="pill pill-violet">{r.ord}장</span>
              <h3 style={{ margin: "10px 0 0" }}>{r.title}</h3>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

function StatStrip({ d }: { d: Detail | null }) {
  return (
    <section className="card stat-strip">
      {(d?.stats ?? []).map((x) => (
        <div key={x.label}>
          <small>{x.label}</small>
          <b className="num">{x.value}</b>
        </div>
      ))}
    </section>
  );
}
