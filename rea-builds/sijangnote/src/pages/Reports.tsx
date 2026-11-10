import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { PageMeta } from "../components/Shell";
import { useFetch } from "../lib/useFetch";
import { api, post, Report } from "../lib/api";

export default function Reports() {
  const { data, reload, setData } = useFetch<Report[]>("/reports");
  const [params, setParams] = useSearchParams();
  const [sel, setSel] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "paste" | "edit" | "criteria">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = Number(params.get("id"));
    if (id) setSel(id);
  }, [params]);
  useEffect(() => {
    if (data?.length && (sel === null || !data.some((r) => r.id === sel))) setSel(data[0].id);
  }, [data, sel]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const cur = data?.find((r) => r.id === sel) ?? null;

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const r = await post<Report>("/reports", fd);
      setData((d) => [r, ...(d ?? [])]);
      setSel(r.id);
      setToast(`'${r.title}' 평가를 마쳤어요. ${r.evaluation.total}점`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rescore = async (body: { text?: string; applyFinding?: number }) => {
    if (!cur) return;
    setBusy(true);
    try {
      const before = cur.evaluation.total;
      const r = await post<Report>(`/reports/${cur.id}/rescore`, body);
      setData((d) => d?.map((x) => (x.id === r.id ? r : x)) ?? null);
      const diff = r.evaluation.total - before;
      setToast(`다시 평가했어요. ${r.evaluation.total}점 (${diff >= 0 ? "+" : ""}${diff})`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
      setModal(null);
    }
  };

  const remove = async () => {
    if (!cur || !confirm(`'${cur.title}' 보고서를 삭제할까요?`)) return;
    await api(`/reports/${cur.id}`, { method: "DELETE" });
    setSel(null);
    setParams({});
    reload();
  };

  const main = cur?.evaluation.findings[0];
  const C = 2 * Math.PI * 70;

  return (
    <>
      <PageMeta crumb="AI 평가" title="보고서 평가" />
      <div className="reports">
        <section className="report-list" aria-label="내 보고서">
          <div className="h"><b>내 보고서</b><span className="count">{data?.length ?? 0}건</span></div>
          <button
            className={`drop ${over ? "over" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
            disabled={busy}
          >
            <span className="ic"><Upload size={20} /></span>
            <span>{busy ? "평가하는 중…" : "새 보고서를 끌어다 놓거나 눌러서 올리기"}<br /><small style={{ opacity: 0.6 }}>.txt, .md · 또는 <u onClick={(e) => { e.stopPropagation(); setModal("paste"); }}>본문 붙여 넣기</u></small></span>
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          {(data ?? []).map((r) => (
            <button key={r.id} className={`r-item ${r.id === sel ? "sel" : ""}`} onClick={() => { setSel(r.id); setParams({ id: String(r.id) }); }} aria-pressed={r.id === sel}>
              <span className="kind">{r.kind}</span>
              <span className="t"><b>{r.title}</b><small>{fmtDate(r.created)} 평가</small></span>
              <span className="s num">{r.evaluation.total}</span>
            </button>
          ))}
        </section>

        <div>
          {cur ? (
            <>
              <section className="card score-card">
                <div className="ring" aria-label={`총점 ${cur.evaluation.total}점`}>
                  <svg width="170" height="170" viewBox="0 0 170 170">
                    <circle cx="85" cy="85" r="70" fill="none" stroke="var(--track)" strokeWidth="14" />
                    <circle cx="85" cy="85" r="70" fill="none" stroke="var(--primary)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * cur.evaluation.total) / 100} ${C}`} style={{ transition: "stroke-dasharray .6s" }} />
                  </svg>
                  <div className="c"><div><b className="num">{cur.evaluation.total}</b><small>100점 만점</small></div></div>
                </div>
                <div>
                  {cur.evaluation.criteria.map((c) => (
                    <div className="crit" key={c.key} title={c.signals.join(" · ")}>
                      <span>{c.label}</span>
                      <span className="track"><i className={c.score <= 12 ? "warn" : ""} style={{ width: `${(c.score / c.max) * 100}%` }} /></span>
                      <b className="num">{c.score}</b>
                    </div>
                  ))}
                  {cur.history.length > 1 && (
                    <div className="history">점수 변화: {cur.history.map((h) => h.total).join(" → ")}</div>
                  )}
                </div>
              </section>

              {main ? (
                <section className={`card finding ${main.severity === "꼭 수정" ? "" : "soft"}`}>
                  <span className={`pill ${main.severity === "꼭 수정" ? "pill-danger" : "pill-amber"}`}>{main.severity}</span>
                  <h3>{main.title}</h3>
                  <p>{main.body}</p>
                  <div className="compare">
                    <div className="cur"><small>현재 문장</small>{main.current ?? "(해당 문장 없음)"}</div>
                    <div className="sug"><small>수정 제안</small>{main.suggestion}</div>
                  </div>
                  {cur.evaluation.findings.length > 1 && (
                    <details style={{ marginTop: 14, fontSize: 13 }}>
                      <summary className="muted">다른 제안 {cur.evaluation.findings.length - 1}개</summary>
                      {cur.evaluation.findings.slice(1).map((f, i) => (
                        <div key={i} style={{ marginTop: 10 }}>
                          <b>{f.title}</b> · <span className="muted">{f.body}</span>
                          <div className="muted">제안: {f.suggestion}</div>
                          <button className="btn btn-ghost" style={{ height: 32, marginTop: 6, fontSize: 13 }} disabled={busy} onClick={() => rescore({ applyFinding: i + 1 })}>이 제안 적용</button>
                        </div>
                      ))}
                    </details>
                  )}
                </section>
              ) : (
                <section className="card finding soft"><span className="pill pill-violet">잘했어요</span><h3>꼭 고칠 부분이 없습니다</h3><p>모든 항목이 기준을 넘었습니다.</p></section>
              )}

              <div className="actions">
                <button className="btn btn-ghost" onClick={remove}>삭제</button>
                <button className="btn btn-ghost" onClick={() => setModal("criteria")}>평가 기준 보기</button>
                <button className="btn btn-ghost" onClick={() => setModal("edit")}>본문 고치기</button>
                {main && <button className="btn btn-ghost" disabled={busy} onClick={() => rescore({ applyFinding: 0 })}>제안 적용</button>}
                <button className="btn btn-primary" disabled={busy} onClick={() => setModal("edit")}>수정본 다시 평가</button>
              </div>
              <p className="muted" style={{ fontSize: 12, textAlign: "right" }}><span className="inf-tag">추론 INF-006 · INF-007</span> 채점 규칙은 화면을 보고 추론해 만든 것입니다.</p>
            </>
          ) : (
            <div className="empty-state">보고서를 올리면 5개 항목으로 평가합니다.</div>
          )}
        </div>
      </div>

      {modal === "edit" && cur && <EditModal title="수정본 다시 평가" initial={cur.text} busy={busy} onClose={() => setModal(null)} onSubmit={(text) => rescore({ text })} />}
      {modal === "paste" && (
        <EditModal
          title="본문 붙여 넣어 평가"
          withTitle
          initial=""
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={async (text, title) => {
            setBusy(true);
            try {
              const r = await post<Report>("/reports", { title, text });
              setData((d) => [r, ...(d ?? [])]);
              setSel(r.id);
              setModal(null);
              setToast(`평가를 마쳤어요. ${r.evaluation.total}점`);
            } catch (e) {
              setToast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {modal === "criteria" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="평가 기준">
            <h2>평가 기준 (5개 항목 × 20점)</h2>
            <table className="table">
              <tbody>
                <tr><td><b>근거 자료</b></td><td>숫자가 있는 문장, '에 따르면·공시·기준' 같은 출처 표현</td></tr>
                <tr><td><b>용어 정확성</b></td><td>용어 사전 단어를 쓴 개수. '무조건·절대' 같은 단정 표현은 감점</td></tr>
                <tr><td><b>데이터 분석</b></td><td>숫자를 다른 대상과 비교한 문장</td></tr>
                <tr><td><b>위험 설명</b></td><td>손실·하락·환율·금리·변동성을 다룬 문장. 위험을 낮춰 말하면 감점</td></tr>
                <tr><td><b>기대 결과</b></td><td>결론·목표·기대를 밝힌 문장</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 13 }}><span className="inf-tag">추론 INF-006</span> 원본 화면의 항목과 만점(20점)은 그대로이고, 항목별 세부 규칙은 추론해 만든 것입니다.</p>
            {cur && (
              <>
                <h2 style={{ fontSize: 16, marginTop: 18 }}>이 보고서에서 찾은 신호</h2>
                <ul style={{ fontSize: 13, color: "var(--text-2)" }}>
                  {cur.evaluation.criteria.map((c) => <li key={c.key}><b>{c.label} {c.score}점</b> · {c.signals.join(" · ")}</li>)}
                </ul>
              </>
            )}
            <div className="actions"><button className="btn btn-primary" onClick={() => setModal(null)}>닫기</button></div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function EditModal({ title, initial, busy, withTitle, onClose, onSubmit }: { title: string; initial: string; busy: boolean; withTitle?: boolean; onClose: () => void; onSubmit: (text: string, title: string) => void }) {
  const [text, setText] = useState(initial);
  const [name, setName] = useState("");
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {withTitle && <input type="text" placeholder="보고서 제목" value={name} onChange={(e) => setName(e.target.value)} />}
        <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="보고서 본문" autoFocus />
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" disabled={busy || text.trim().length < 20} onClick={() => onSubmit(text, name)}>{busy ? "평가 중…" : "평가하기"}</button>
        </div>
      </div>
    </div>
  );
}

const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
