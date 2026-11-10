import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageMeta } from "../components/Shell";
import Logo from "../components/Logo";
import { useFetch } from "../lib/useFetch";
import { api, Point, Quote } from "../lib/api";
import { won } from "../lib/format";

/** 투자 전략: 과거(가상) 시세로 적립식 투자를 되돌려 보는 시뮬레이터. 원본 화면에 없던 화면이라 새로 설계 */
export function Strategy() {
  const { data: etfs } = useFetch<(Quote & { category: string })[]>("/etfs");
  const [code, setCode] = useState("SNP500");
  const [monthly, setMonthly] = useState(30);
  const { data: s } = useFetch<{ points: Point[] }>(`/market/${code}/series?range=5y`);

  const sim = useMemo(() => {
    if (!s?.points.length) return null;
    let units = 0, paid = 0, lastMonth = "";
    for (const p of s.points) {
      const m = p.date.slice(0, 7);
      if (m !== lastMonth) { units += (monthly * 10000) / p.close; paid += monthly * 10000; lastMonth = m; }
    }
    const value = units * s.points[s.points.length - 1].close;
    return { paid, value, gain: value / paid - 1, months: new Set(s.points.map((p) => p.date.slice(0, 7))).size };
  }, [s, monthly]);

  return (
    <>
      <PageMeta crumb="투자 전략" title="적립식 시뮬레이터" />
      <div className="grid-2">
        <section className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>조건</h2>
          <label className="form-row">ETF
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              {(etfs ?? []).map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}
            </select>
          </label>
          <label className="form-row">매달 {monthly}만원
            <input type="range" min={5} max={300} step={5} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
          </label>
          <p className="muted" style={{ fontSize: 13 }}>최근 5년 동안 매달 첫 거래일에 같은 금액을 샀다고 가정합니다. 가상 시세로 계산하므로 학습용입니다.</p>
        </section>
        <section className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>결과</h2>
          {sim ? (
            <table className="table"><tbody>
              <tr><td className="muted">투자 기간</td><td>{sim.months}개월</td></tr>
              <tr><td className="muted">넣은 돈</td><td className="num">{won(sim.paid)}</td></tr>
              <tr><td className="muted">평가 금액</td><td className="num"><b>{won(sim.value)}</b></td></tr>
              <tr><td className="muted">수익률</td><td className={`num ${sim.gain >= 0 ? "up" : "down"}`}>{(sim.gain * 100).toFixed(1)}%</td></tr>
            </tbody></table>
          ) : <div className="skeleton" style={{ height: 160 }} />}
          <Link to="/app/learn/etf-101-4" className="muted" style={{ fontSize: 13 }}>4장 장기 투자와 복리 읽기 →</Link>
        </section>
      </div>
    </>
  );
}

export function Settings() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <PageMeta crumb="설정" title="설정" />
      <section className="card" style={{ padding: 24, maxWidth: 640 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>내 정보</h2>
        <p className="muted">데모 계정(김)으로 사용 중입니다. 실제 로그인·결제 기능은 없습니다.</p>
        <h2 style={{ fontSize: 18 }}>데이터</h2>
        <button className="btn btn-ghost" onClick={async () => { await api("/ask", { method: "DELETE" }); setMsg("질문 기록을 지웠어요."); }}>AI 질문 기록 지우기</button>
        {msg && <p className="muted">{msg}</p>}
        <h2 style={{ fontSize: 18 }}>안내</h2>
        <p className="muted" style={{ fontSize: 13 }}>모든 정보는 학습용이며 투자 권유가 아닙니다. 수치는 예시 데이터입니다. 화면 아래 '추론된 로직' 배지는 개발 모드에서만 보입니다.</p>
      </section>
    </>
  );
}

/** 데모 로그인: 비밀번호를 받지 않습니다 (원본과 혼동될 수 있는 인증 화면을 만들지 않음) */
export function Login() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", background: "var(--navy-900)", padding: 16 }}>
      <div className="card" style={{ padding: 32, width: "min(400px, 100%)", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", color: "var(--text)" }}><Logo /></div>
        <h1 style={{ fontSize: 22, margin: "20px 0 8px" }}>데모로 시작하기</h1>
        <p className="muted" style={{ fontSize: 14 }}>이 앱은 학습용 데모라 계정이 필요 없습니다. 기록은 이 컴퓨터의 로컬 DB에만 저장됩니다.</p>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => nav("/app/dashboard")}>데모 계정으로 들어가기</button>
        <Link to="/" className="muted" style={{ display: "inline-block", marginTop: 14, fontSize: 13 }}>처음으로</Link>
      </div>
    </div>
  );
}
