// OpenDART 실시간 공시 화면 조각: 상태 안내, 기업별 공시·기업개황·주요 재무, 50개 기업 공시 피드.
import { ExternalLink, KeyRound, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { useFetch } from "../lib/useFetch";

export type DartStatus = { configured: boolean; mode: "live" | "offline"; reason: string | null; lastOk: string | null; lastError: { code: string; message: string } | null };
export type Disclosure = { date: string; title: string; filer: string; rcept: string; link: string; ticker: string; name: string; note: string };
type FinTable = { title: string; report: string; year: string; fs: string; periods: string[]; rows: { key: string; label: string; values: (number | null)[] }[]; ratios: { label: string; value: number | null; unit: string }[]; link: string };
type DartData = {
  company: { ticker: string; name: string; sector: string; agent: boolean };
  status: DartStatus;
  overview: { corpName: string; ceo: string; established: string; homepage: string; address: string; fiscalMonth: string } | null;
  disclosures: Disclosure[];
  financials: { annual: FinTable | null; interim: FinTable | null } | null;
  errors: { part: string; code: string; message: string }[];
  fetchedAt?: string;
};

const eok = (v: number | null) => (v == null ? "—" : Math.round(v / 1e8).toLocaleString("ko-KR"));
const STANDALONE = !!import.meta.env.VITE_STANDALONE;

/** 키가 없을 때 안내 */
export function DartSetup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="dart-setup" role="note">
      <KeyRound size={16} aria-hidden />
      <div>
        <b>OpenDART 실시간 공시가 꺼져 있습니다.</b>
        {STANDALONE ? (
          <span> 서버 없이 여는 단일 HTML에서는 실시간 공시를 부를 수 없습니다. PC에서 <code>npm run dev</code>로 띄운 화면에서 보세요.</span>
        ) : (
          <span> 앱 폴더에 <code>dart.config.json</code>을 만들고 <code>{'{"apiKey": "인증키"}'}</code>를 넣은 뒤 서버를 다시 켜세요.{!compact && <> 인증키는 <a href="https://opendart.fss.or.kr/" target="_blank" rel="noreferrer">OpenDART</a>에서 무료로 받을 수 있고, 이 파일은 저장소에 올라가지 않습니다.</>}</span>
        )}
      </div>
    </div>
  );
}

export function LiveBadge({ s }: { s: DartStatus | null | undefined }) {
  if (!s) return null;
  return s.configured ? (
    <span className="pill pill-violet"><Radio size={11} aria-hidden /> OpenDART 실시간</span>
  ) : (
    <span className="pill pill-gray">OpenDART 꺼짐</span>
  );
}

function DisclosureList({ items, showName = false, empty }: { items: Disclosure[]; showName?: boolean; empty: string }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <ul className="dart-list">
      {items.map((d) => (
        <li key={d.rcept}>
          <span className="num muted">{d.date.slice(5)}</span>
          <span className="t">
            {showName && <Link to={`/app/company/${d.ticker}?tab=dart`} className="co-name">{d.name}</Link>}
            <a href={d.link} target="_blank" rel="noreferrer">{d.title}</a>
            {d.note && <small className="pill pill-gray">{d.note}</small>}
          </span>
          <small className="muted f">{d.filer}</small>
        </li>
      ))}
    </ul>
  );
}

/** 50개 기업 최근 공시 피드 (목록 화면 위) */
export function DartFeed() {
  const { data } = useFetch<{ status: DartStatus; items: Disclosure[]; days?: number; error?: { message: string } }>("/dart/feed?days=3");
  return (
    <section className="card co-card dart-feed">
      <div className="head">
        <h2>최근 3일 공시</h2>
        <LiveBadge s={data?.status} />
      </div>
      {!data ? <div className="skeleton" style={{ height: 80 }} /> : !data.status.configured ? <DartSetup /> : data.error ? <p className="pill pill-danger" role="alert">{data.error.message}</p> : <DisclosureList items={data.items.slice(0, 12)} showName empty="50개 기업의 최근 3일 공시가 없습니다." />}
    </section>
  );
}

function Fin({ t, note }: { t: FinTable; note: string }) {
  return (
    <section className="card co-card">
      <div className="head">
        <h2>{t.title} <small className="muted">· {t.fs} · 억원</small></h2>
        {t.link && <a className="pill pill-gray" href={t.link} target="_blank" rel="noreferrer">원문 <ExternalLink size={11} aria-hidden /></a>}
      </div>
      <div className="co-scroll">
        <table className="table">
          <thead>
            <tr><th>계정</th>{t.periods.map((p, i) => <th key={i} className="num">{p || "—"}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.filter((r) => r.values.some((v) => v != null)).map((r) => (
              <tr key={r.key}><td>{r.label}</td>{r.values.map((v, i) => <td key={i} className="num">{eok(v)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dart-ratios">
        {t.ratios.map((r) => (
          <span key={r.label}><small className="muted">{r.label}</small> <b className="num">{r.value == null ? "—" : `${r.value}${r.unit}`}</b></span>
        ))}
        <span className="inf-tag">추론 INF-015 · 비율은 앱이 계산</span>
      </div>
      <small className="muted">{note}</small>
    </section>
  );
}

/** 기업 상세의 "공시·재무 (OpenDART)" 탭 */
export function DartView({ ticker }: { ticker: string }) {
  const { data, error } = useFetch<DartData>(`/companies/${ticker}/dart`);
  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="card skeleton" style={{ height: 240 }} />;
  if (!data.status.configured) return <DartSetup />;
  const ov = data.overview;
  const f = data.financials;
  return (
    <div className="dart-view">
      {data.errors.length > 0 && (
        <div className="co-warn" role="alert">
          <span>일부를 불러오지 못했습니다. {data.errors.map((e) => `${e.part}: ${e.message}`).join(" · ")}</span>
        </div>
      )}
      {ov && (
        <section className="card co-card dart-ov">
          <div><small className="muted">정식 이름</small><b>{ov.corpName}</b></div>
          <div><small className="muted">대표</small><b>{ov.ceo || "—"}</b></div>
          <div><small className="muted">설립일</small><b className="num">{ov.established || "—"}</b></div>
          <div><small className="muted">결산월</small><b>{ov.fiscalMonth || "—"}</b></div>
          <div className="wide"><small className="muted">홈페이지</small>{ov.homepage ? <a href={ov.homepage} target="_blank" rel="noreferrer">{ov.homepage.replace(/^https?:\/\//, "")}</a> : <b>—</b>}</div>
        </section>
      )}
      <div className="grid-2 dart-grid">
        <section className="card co-card">
          <div className="head">
            <h2>최근 90일 공시 <small className="muted">{data.disclosures.length}건</small></h2>
            <LiveBadge s={data.status} />
          </div>
          <DisclosureList items={data.disclosures.slice(0, 15)} empty="최근 90일 동안 낸 공시가 없습니다." />
        </section>
        <div className="dart-fins">
          {f?.interim && <Fin t={f.interim} note="손익은 보고서의 당기 금액, 재무상태는 기말 잔액입니다(공시 원문 숫자를 억원으로 반올림)." />}
          {f?.annual && <Fin t={f.annual} note="가장 최근 사업보고서의 3개 사업연도입니다." />}
          {f && !f.annual && !f.interim && <section className="card co-card"><p className="muted" style={{ margin: 0 }}>정기보고서 재무 숫자를 찾지 못했습니다.</p></section>}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        출처: 금융감독원 OpenDART. {data.fetchedAt ? `${new Date(data.fetchedAt).toLocaleString("ko-KR")} 조회 · ` : ""}공시는 5분, 재무는 6시간 동안 다시 부르지 않습니다. 학습용이며 투자 권유가 아닙니다.
      </p>
    </div>
  );
}
