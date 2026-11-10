// 모든 화면 오른쪽 아래에 뜨는 AI 챗봇.
// 답변은 서버의 /api/ask(참고서·용어 사전·P02·P04 Agent 주장 검색)로 만들고, 근거 문서와 유사도를 함께 보여 줍니다.
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUp, Bot, ExternalLink, X } from "lucide-react";
import Rich from "./Rich";
import { AskResult, post } from "../lib/api";

const SUGGEST = ["기업은행 부문별 이자수익 알려줘", "KB금융 P02 보류 이유는?", "삼성전자 P04 기술적 분석 결과는?", "한화오션 사업부 매출", "삼성전자 HBM 매출은 얼마야?", "SK하이닉스 최대낙폭은?", "추적 오차가 뭐야?"];

type Msg = { q: string; r?: AskResult; error?: string };

export default function ChatWidget() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  if (loc.pathname.startsWith("/app/ask")) return null; // 질문 화면에는 이미 대화창이 있음

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setQ("");
    setBusy(true);
    setMsgs((m) => [...m, { q: t }]);
    try {
      const r = await post<AskResult>("/ask", { question: t });
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, r } : x)));
    } catch (e) {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };

  return (
    <>
      {!open && (
        <button className="cw-fab" onClick={() => setOpen(true)} aria-label="AI 챗봇 열기">
          <Bot size={20} aria-hidden />
          <span>AI 챗봇</span>
        </button>
      )}
      {open && (
        <section className="cw" role="dialog" aria-label="AI 챗봇">
          <header>
            <span className="cw-ava"><Bot size={16} aria-hidden /></span>
            <div>
              <b>시장노트 AI</b>
              <small>참고서 · 용어 사전 · P02·P04 Agent 결과에서 근거를 찾아 답합니다</small>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="AI 챗봇 닫기"><X size={16} /></button>
          </header>
          <div className="cw-body">
            {!msgs.length && (
              <div className="cw-hello">
                <p>안녕하세요. 코스피 50개 기업의 <b>사업 분석(P02)</b>과 <b>기술적 분석(P04)</b> 결과, ETF 용어를 물어보세요. Agent 결과는 모두 <b>검증 전</b>입니다.</p>
                <div className="cw-sugg">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className="cw-turn">
                <div className="cw-q">{m.q}</div>
                {m.r && (
                  <div className="cw-a">
                    <div className="cw-steps">{m.r.steps.map((s) => <span key={s}>{s}</span>)}</div>
                    <div className="cw-text"><Rich text={m.r.answer} /></div>
                    {m.r.sources.length > 0 && (
                      <ul className="cw-src">
                        {m.r.sources.map((s) => (
                          <li key={s.id}>
                            {s.link?.startsWith("http") ? (
                              <a href={s.link} target="_blank" rel="noreferrer">
                                <span>{s.title} <small className="muted">· {s.source}</small></span>
                                <span className="num">{s.score.toFixed(2)}</span>
                                <ExternalLink size={11} aria-hidden />
                              </a>
                            ) : (
                              <Link to={s.link ?? "/app/ask"} onClick={() => setOpen(false)}>
                                <span>{s.title} <small className="muted">· {s.source}</small></span>
                                <span className="num">{s.score.toFixed(2)}</span>
                                <ExternalLink size={11} aria-hidden />
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {m.error && <div className="pill pill-danger" role="alert">{m.error}</div>}
                {!m.r && !m.error && busy && i === msgs.length - 1 && <div className="cw-a"><span className="typing"><i /><i /><i /></span></div>}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="cw-input" onSubmit={submit}>
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 삼성전자 DS 매출은?" aria-label="챗봇 질문" maxLength={500} />
            <button type="submit" aria-label="챗봇에 보내기" disabled={!q.trim() || busy}><ArrowUp size={16} /></button>
          </form>
          <small className="cw-foot">숫자는 유사도(0~1)입니다 · 추론 INF-005·INF-017 · 검증 전 결과 포함 · 투자 권유 아님</small>
        </section>
      )}
    </>
  );
}
