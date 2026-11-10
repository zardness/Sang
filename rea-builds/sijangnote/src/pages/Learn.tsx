import { Fragment, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Bookmark, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PageMeta, useShell } from "../components/Shell";
import { useFetch } from "../lib/useFetch";
import { api, post } from "../lib/api";
import { won } from "../lib/format";

type Chapter = { id: string; ord: number; title: string; headline: string; readMin: number; sources: number; updated: string; body: string[]; keyPoints: string[]; glossary: string; series: { title: string; short: string }; prev: string | null; next: string | null };
type Term = { term: string; en: string; def: string; note?: string };

export default function Learn() {
  const { id } = useParams();
  const { learn, reloadLearn } = useShell();
  if (!id) return learn ? <Navigate to={`/app/learn/${learn.current.id}`} replace /> : null;
  return <Reader id={id} learn={learn} reloadLearn={reloadLearn} />;
}

function Reader({ id, learn, reloadLearn }: { id: string; learn: ReturnType<typeof useShell>["learn"]; reloadLearn: () => void }) {
  const { data: ch } = useFetch<Chapter>(`/learn/${id}`);
  const { data: terms } = useFetch<Term[]>("/glossary");
  const [term, setTerm] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const done = !!learn?.chapters.find((c) => c.id === id)?.done;

  useEffect(() => setTerm(null), [id]);

  // [추론 INF-009] 읽은 시간을 30초마다 기록, 본문 끝이 보이면 완료로 표시
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") post(`/learn/${id}/progress`, { addSec: 30 }).then(reloadLearn).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [id, reloadLearn]);
  useEffect(() => {
    const el = endRef.current;
    if (!el || done) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      // 끝까지 훑기만 한 경우를 거르려고 5초 이상 머물 때만 완료 처리
      if (e.isIntersecting) timer = setTimeout(() => post(`/learn/${id}/progress`, { done: true }).then(reloadLearn), 5000);
    });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [id, done, ch, reloadLearn]);

  const shown = terms?.find((t) => t.term === (term ?? ch?.glossary));

  return (
    <>
      <PageMeta crumb={`학습 / ${ch?.series.short ?? ""}`} title={ch?.title ?? ""} />
      <div className="learn">
        <aside className="toc" aria-label="목차">
          <h6>{ch?.series.title}</h6>
          {learn?.chapters.map((c) => (
            <Link key={c.id} to={`/app/learn/${c.id}`} className={c.id === id ? "cur" : ""} aria-current={c.id === id ? "page" : undefined}>
              <span className={`dot ${c.done ? "done" : ""} ${c.id === id ? "cur" : ""}`} />
              {c.title}
            </Link>
          ))}
        </aside>

        <article className="card article">
          {ch ? (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="pill pill-violet">{ch.ord}장</span>
                <span className="pill pill-gray">읽는 시간 {ch.readMin}분</span>
                {done && <span className="pill pill-violet"><Check size={12} /> 다 읽음</span>}
              </div>
              <h1>{ch.headline}</h1>
              <div className="meta">
                <span>작성 시장노트 팀</span>
                <span>근거 문서 {ch.sources}건</span>
                <span>{ch.updated} 수정</span>
              </div>
              {ch.body.map((p, i) => (
                <p key={i}>
                  {p.split(/(\{\{[^}]+\}\})/g).map((seg, j) =>
                    seg.startsWith("{{") ? (
                      <button key={j} className="term-link" aria-pressed={shown?.term === seg.slice(2, -2)} onClick={() => setTerm(seg.slice(2, -2))}>
                        {seg.slice(2, -2)}
                      </button>
                    ) : (
                      <Fragment key={j}>{seg}</Fragment>
                    ),
                  )}
                </p>
              ))}
              <div className="keypoints">
                <b>이 장의 핵심</b>
                <ul>{ch.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
              </div>
              <div ref={endRef} className="nav-foot">
                {ch.prev ? <Link className="btn btn-ghost" to={`/app/learn/${ch.prev}`}><ChevronLeft size={16} />이전 장</Link> : <span />}
                <div style={{ display: "flex", gap: 8 }}>
                  {!done && <button className="btn btn-ghost" onClick={() => post(`/learn/${id}/progress`, { done: true }).then(reloadLearn)}><Check size={16} />다 읽었어요</button>}
                  {ch.next && <Link className="btn btn-primary" to={`/app/learn/${ch.next}`}>다음 장<ChevronRight size={16} /></Link>}
                </div>
              </div>
            </>
          ) : (
            <div className="skeleton" style={{ height: 400 }} />
          )}
        </article>

        <div className="term-col">
          {shown && <TermCard t={shown} />}
        </div>
      </div>
    </>
  );
}

function TermCard({ t }: { t: Term }) {
  return (
    <section className="card term-card" aria-live="polite">
      <span className="pill pill-amber"><Bookmark size={12} /> 용어 풀이</span>
      <h3>{t.term}</h3>
      <div className="en">{t.en}</div>
      <p>{t.def}</p>
      {t.note === "fee-calculator" && <FeeCalc />}
      <Link to={`/app/ask?q=${encodeURIComponent(t.term + "에 대해 더 알려줘")}`} className="muted" style={{ fontSize: 12, display: "inline-block", marginTop: 12 }}>AI에게 더 물어보기 →</Link>
    </section>
  );
}

/** [추론 INF-008] 총보수 차이 계산기. 원본의 고정 문장을 직접 바꿔 볼 수 있는 계산기로 확장 */
function FeeCalc() {
  const [p, setP] = useState(1000);
  const [y, setY] = useState(10);
  const [r, setR] = useState(6.5);
  const [diff, setDiff] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      api<{ difference: number }>(`/calc/fee?principal=${p * 10000}&years=${y}&a=0.07&b=0.25&return=${r}`).then((d) => setDiff(d.difference)).catch(() => setDiff(null));
    }, 150);
    return () => clearTimeout(t);
  }, [p, y, r]);
  return (
    <div className="calc">
      0.07%와 0.25%의 차이는 {p.toLocaleString("ko-KR")}만원을 {y}년 두면 약 <b style={{ color: "var(--text)" }}>{diff === null ? "…" : won(diff)}</b>입니다.
      <div className="inputs">
        <label>원금(만원)<input type="number" min={10} step={100} value={p} onChange={(e) => setP(Math.max(0, Number(e.target.value)))} /></label>
        <label>기간(년)<input type="number" min={1} max={60} value={y} onChange={(e) => setY(Math.min(60, Math.max(1, Number(e.target.value))))} /></label>
        <label style={{ gridColumn: "1 / -1" }}>가정 수익률(연 %)<input type="number" step={0.5} value={r} onChange={(e) => setR(Number(e.target.value))} /></label>
      </div>
      <span className="inf-tag" style={{ marginTop: 8 }}>추론 INF-008 · 연 {r}% 수익 가정</span>
    </div>
  );
}
