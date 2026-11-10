import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUp, Check, Copy, LineChart, Search } from "lucide-react";
import { PageMeta, useShell } from "../components/Shell";
import Rich from "../components/Rich";
import { api, AskResult, post } from "../lib/api";

const SUGGEST = ["장기 투자용으로 국내 ETF랑 해외 ETF 중에 뭘 먼저 공부하면 좋아?", "총보수가 뭐야?", "기업은행 부문별 이자수익 알려줘", "KB금융 P02 보류 이유는?", "삼성전자 P04 기술적 분석 결과는?", "한화오션 사업부 매출"];
const STEP_ICON: Record<string, JSX.Element> = { "참고서 검색": <Search size={12} />, "시세 조회": <LineChart size={12} />, "답변 정리": <Check size={12} /> };

export default function Ask() {
  const [items, setItems] = useState<AskResult[]>([]);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const { setAiOpen } = useShell();
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    api<{ docCount: number; history: AskResult[] }>("/ask").then((d) => {
      setItems(d.history);
      setDocCount(d.docCount);
    });
  }, []);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setPending(text);
    setError(null);
    setQ("");
    try {
      const r = await post<AskResult>("/ask", { question: text });
      setItems((xs) => [...xs, r]);
      setFocus(r.id);
      setAiOpen(true);
    } catch (e) {
      setError((e as Error).message);
      setQ(text);
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    const pre = params.get("q");
    if (pre && !asked.current) {
      asked.current = true;
      setParams({}, { replace: true });
      ask(pre);
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, pending]);

  const shown = items.find((x) => x.id === focus) ?? items[items.length - 1];
  const panel = useMemo(
    () => ({
      title: "답변 근거",
      chip: <Copy size={14} />,
      body: shown ? (
        <>
          {shown.sources.map((s) => (
            <SrcLink to={s.link} className="src-card" key={s.id}>
              <div className="h">{s.title}<span className="num">{s.score.toFixed(2)}</span></div>
              <small>{s.source}</small>
              <p>{s.snippet}</p>
            </SrcLink>
          ))}
          <small className="muted" style={{ fontSize: 12 }}>숫자는 질문과 문서의 유사도입니다. RAG 검색 결과를 그대로 보여줍니다.</small>
          <span className="inf-tag" style={{ alignSelf: "flex-start" }}>{(shown as { inferred?: string }).inferred === "INF-016" ? "추론 INF-016 · OpenDART 실시간 조회" : (shown as { inferred?: string }).inferred === "INF-017" ? "추론 INF-017 · 저장된 Agent 결과 조회 · 검증 전" : "추론 INF-005 · 문자 2-gram TF-IDF 코사인 유사도"}</span>
        </>
      ) : (
        <small className="muted">질문하면 답변에 쓴 참고 문서가 여기에 나옵니다.</small>
      ),
    }),
    [shown],
  );

  return (
    <>
      <PageMeta crumb={`참고서 문서 ${docCount ?? "…"}건에서 찾아 답합니다`} title="AI에게 질문" panel={panel} />
      <div className="ask">
        <div className="thread">
          {!items.length && !pending && (
            <div className="empty-state">
              <h2 style={{ color: "var(--text)", margin: "40px 0 8px" }}>무엇이든 물어보세요</h2>
              <p>참고서와 용어 사전, 종목 정보, 50개 기업의 P02·P04 Agent 결과(검증 전)에서 근거를 찾아 답합니다.</p>
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} style={{ display: "contents" }}>
              <div className="q-bubble">{it.question}</div>
              <div className="a-row">
                <span className="ai-chip">AI</span>
                <div className="a-card" onClick={() => setFocus(it.id)} style={{ outline: shown?.id === it.id && items.length > 1 ? "2px solid var(--primary-100)" : undefined }}>
                  <div className="steps">{it.steps.map((s) => <span className="step" key={s}>{STEP_ICON[s]}{s}</span>)}</div>
                  <div className="text"><Rich text={it.answer} /></div>
                  <div className="refs">
                    {it.sources.filter((s, i, a) => a.findIndex((x) => x.title === s.title) === i).map((s) => <SrcLink key={s.id} to={s.link}>{s.title.replace(/^용어 사전: /, "용어 사전")}</SrcLink>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {pending && (
            <>
              <div className="q-bubble">{pending}</div>
              <div className="a-row"><span className="ai-chip">AI</span><div className="a-card"><div className="steps"><span className="step"><Search size={12} />참고서 검색</span></div><span className="typing"><i /><i /><i /></span></div></div>
            </>
          )}
          {error && <div className="pill pill-danger" role="alert">{error}</div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="궁금한 내용을 입력하세요" aria-label="질문" maxLength={500} />
            <button type="submit" aria-label="보내기" disabled={!q.trim() || !!pending}><ArrowUp size={18} /></button>
          </form>
          {!items.length && (
            <div className="suggests">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          )}
        </div>
      </div>
    </>
  );
}

/** 앱 안 링크는 Link, OpenDART 원문 같은 바깥 주소는 새 탭 */
function SrcLink({ to, className, children }: { to?: string | null; className?: string; children: React.ReactNode }) {
  return to?.startsWith("http") ? <a href={to} target="_blank" rel="noreferrer" className={className}>{children}</a> : <Link to={to ?? "#"} className={className}>{children}</Link>;
}
