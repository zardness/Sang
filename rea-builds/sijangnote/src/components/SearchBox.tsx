import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { fmtPrice } from "../lib/format";
import Change from "./Change";

type Result = {
  instruments: { code: string; name: string; last: number; changePct: number; unit: string | null; href: string }[];
  companies?: { ticker: string; name: string; market: string; href: string }[];
  chapters: { id: string; title: string; href: string }[];
  terms: { term: string; def: string }[];
};

export default function SearchBox({ variant, initial = "", placeholder }: { variant: "top" | "hero"; initial?: string; placeholder?: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(initial), [initial]);
  useEffect(() => {
    if (!q.trim()) return setRes(null);
    const t = setTimeout(() => api<Result>(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes(null)), 160);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const links = res
    ? [
        ...res.instruments.map((i) => i.href),
        ...(res.companies ?? []).map((c) => c.href),
        ...res.chapters.map((c) => c.href),
        ...res.terms.map(() => `/app/ask?q=${encodeURIComponent(q)}`),
      ]
    : [];
  const go = (href: string) => {
    setOpen(false);
    nav(href);
  };
  const submit = () => {
    if (links[active]) return go(links[active]);
    if (q.trim()) go(`/app/ask?q=${encodeURIComponent(q.trim())}`);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(links.length - 1, a + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") setOpen(false);
  };

  let n = -1;
  const dropdown = open && q.trim() && (
    <div className="dropdown" role="listbox">
      {!res ? <div className="empty">찾는 중…</div> : null}
      {res && !links.length ? <div className="empty">결과가 없습니다. Enter를 누르면 AI에게 물어봅니다.</div> : null}
      {res?.instruments.length ? <h6>종목·지수</h6> : null}
      {res?.instruments.map((i) => { n++; const k = n; return (
        <a key={i.code} href={i.href} data-active={k === active} onMouseEnter={() => setActive(k)} onClick={(e) => { e.preventDefault(); go(i.href); }}>
          <span>{i.name}</span>
          <span className="num" style={{ fontSize: 13 }}>{fmtPrice(i.last, i.unit)} <Change value={i.changePct} /></span>
        </a>); })}
      {res?.companies?.length ? <h6>기업 분석 (Agent)</h6> : null}
      {res?.companies?.map((c) => { n++; const k = n; return (
        <a key={c.ticker} href={c.href} data-active={k === active} onMouseEnter={() => setActive(k)} onClick={(e) => { e.preventDefault(); go(c.href); }}>
          <span>{c.name} <small className="muted">{c.ticker}</small></span>
          <small className="muted">사업·기술적 분석</small>
        </a>); })}
      {res?.chapters.length ? <h6>학습</h6> : null}
      {res?.chapters.map((c) => { n++; const k = n; return (
        <a key={c.id} href={c.href} data-active={k === active} onMouseEnter={() => setActive(k)} onClick={(e) => { e.preventDefault(); go(c.href); }}>{c.title}</a>); })}
      {res?.terms.length ? <h6>용어</h6> : null}
      {res?.terms.map((t) => { n++; const k = n; return (
        <a key={t.term} href="#" data-active={k === active} onMouseEnter={() => setActive(k)} onClick={(e) => { e.preventDefault(); go(`/app/ask?q=${encodeURIComponent(t.term + "가 뭐야?")}`); }}>
          <span><b>{t.term}</b> <small className="muted">{t.def}</small></span>
        </a>); })}
    </div>
  );

  const input = (
    <input
      value={q}
      onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKey}
      placeholder={placeholder ?? "종목, ETF, 기업, 용어 검색"}
      aria-label="검색"
      role="combobox"
      aria-expanded={!!dropdown}
    />
  );

  if (variant === "hero")
    return (
      <div className="big-search" ref={box}>
        {input}
        <button className="go" onClick={submit} aria-label="검색"><Search size={18} /></button>
        {dropdown}
      </div>
    );
  return (
    <div className="top-search" ref={box}>
      <div className="field"><Search size={15} aria-hidden />{input}</div>
      {dropdown}
    </div>
  );
}
