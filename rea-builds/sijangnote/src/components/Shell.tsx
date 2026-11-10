import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, BookText, Building2, FileCheck2, LayoutGrid, Menu, MessageSquareText, PanelLeft, PanelRight, Settings, SlidersVertical, Target, X } from "lucide-react";
import Logo from "./Logo";
import SearchBox from "./SearchBox";
import InferenceBadge from "./InferenceBadge";
import ChatWidget from "./ChatWidget";
import { useFetch } from "../lib/useFetch";
import type { Briefing, Learning } from "../lib/api";

type Panel = { title: string; chip?: ReactNode; body: ReactNode } | null;
type Meta = { crumb: string; title: string; panel?: Panel };

const ShellCtx = createContext<{ setMeta: (m: Meta) => void; aiOpen: boolean; setAiOpen: (v: boolean) => void; learn: Learning | null; reloadLearn: () => void }>(null!);
export const useShell = () => useContext(ShellCtx);

/** 페이지가 상단 제목과 AI 패널 내용을 정하는 컴포넌트 */
export function PageMeta(m: Meta) {
  const { setMeta } = useShell();
  useEffect(() => setMeta(m), [m.crumb, m.title, m.panel]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const NAV = [
  { to: "/app/dashboard", label: "대시보드", icon: LayoutGrid },
  { to: "/app/etf", label: "종목·ETF", icon: SlidersVertical },
  { to: "/app/company", label: "기업 분석", icon: Building2 },
  { to: "/app/learn", label: "학습", icon: BookText },
  { to: "/app/strategy", label: "투자 전략", icon: Target },
  { to: "/app/reports", label: "보고서 평가", icon: FileCheck2 },
  { to: "/app/ask", label: "AI에게 질문", icon: MessageSquareText },
];

const read = (k: string, d: boolean) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v === "1";
  } catch {
    return d;
  }
};
const write = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? "1" : "0");
  } catch {
    /* 저장소를 못 써도 동작에는 문제없음 */
  }
};

export default function Shell() {
  const [meta, setMeta] = useState<Meta>({ crumb: "홈", title: "" });
  const [collapsed, setCollapsed] = useState(() => read("sn.collapsed", false));
  const [aiOpen, setAiOpenState] = useState(() => read("sn.ai", false));
  const [mobileNav, setMobileNav] = useState(false);
  const [bell, setBell] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const { data: learn, reload: reloadLearn } = useFetch<Learning>("/learn");
  const { data: dash } = useFetch<{ briefings: Briefing[] }>("/dashboard");

  useEffect(() => setMobileNav(false), [loc.pathname]);

  /** [추론 INF-010 · 확신도 낮음] AI 패널을 열면 좁은 화면에서 메뉴를 아이콘 모드로 접는다. */
  const setAiOpen = (v: boolean) => {
    setAiOpenState(v);
    write("sn.ai", v);
    if (v && window.innerWidth < 1600) setCollapsed(true);
  };
  const toggleCollapsed = () => {
    if (window.innerWidth <= 900) return setMobileNav((m) => !m);
    setCollapsed((c) => {
      write("sn.collapsed", !c);
      return !c;
    });
  };

  const ctx = useMemo(() => ({ setMeta, aiOpen, setAiOpen, learn, reloadLearn }), [aiOpen, learn]); // eslint-disable-line react-hooks/exhaustive-deps
  const panel: Panel = meta.panel ?? {
    title: "Agent 브리핑",
    body: (
      <div className="brief-list">
        {(dash?.briefings ?? []).map((b) => (
          <Link key={b.title} to={b.link} className="brief">
            <span className="k">{b.kind}</span>
            <b>{b.title}</b>
            <p>{b.body}</p>
          </Link>
        ))}
      </div>
    ),
  };

  const pct = learn ? Math.round((learn.done / learn.total) * 100) : 0;

  return (
    <ShellCtx.Provider value={ctx}>
      <div className={`shell ${collapsed ? "collapsed" : ""} ${mobileNav ? "mobile-nav" : ""}`} style={{ ["--sb" as string]: collapsed ? "var(--sidebar-c)" : "var(--sidebar)" }}>
        <aside className="sidebar" aria-label="메뉴">
          <Link to="/" aria-label="시장노트 홈"><Logo /></Link>
          <div className="menu-cap">메뉴</div>
          <nav>
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={label}>
                <Icon size={20} strokeWidth={2} aria-hidden />
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="grow" />
          {learn && (
            <Link to={`/app/learn/${learn.current.id}`} className="progress-card">
              <b>ETF 입문 {learn.current.ord}/{learn.total}</b>
              <p>오늘 {learn.remainingMin}분만 더 읽으면 {learn.current.ord}장을 끝낼 수 있어요.</p>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            </Link>
          )}
          <NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title="설정">
            <Settings size={20} aria-hidden />
            <span className="nav-label">설정</span>
          </NavLink>
        </aside>
        {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

        <div className="main">
          <header className="topbar">
            <button className="icon-btn" onClick={toggleCollapsed} aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}>
              {window.innerWidth <= 900 ? <Menu size={18} /> : <PanelLeft size={18} />}
            </button>
            <div className="crumb">
              <small>{meta.crumb}</small>
              <strong>{meta.title}</strong>
            </div>
            <div className="spacer" />
            <SearchBox variant="top" />
            <button className={`ai-toggle ${aiOpen ? "on" : ""}`} onClick={() => setAiOpen(!aiOpen)} aria-expanded={aiOpen}>
              <span className="dot" />
              <span className="lbl">{aiOpen ? "AI 패널 닫기" : "AI 패널 열기"}</span>
            </button>
            <div className="notif">
              <button className="icon-btn" aria-label="알림" aria-expanded={bell} onClick={() => setBell(!bell)}>
                <Bell size={18} />
                {dash?.briefings.length ? <span className="badge" /> : null}
              </button>
              {bell && (
                <div className="dropdown" role="menu">
                  <h6>Agent 브리핑 {dash?.briefings.length ?? 0}건</h6>
                  {(dash?.briefings ?? []).map((b) => (
                    <a key={b.title} href={b.link} onClick={(e) => { e.preventDefault(); setBell(false); nav(b.link); }}>
                      <span><b style={{ fontSize: 13 }}>{b.title}</b><br /><small className="muted">{b.body}</small></span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link to="/app/settings" className="avatar" aria-label="내 정보">김</Link>
          </header>
          <main className="content" id="content">
            <Outlet />
          </main>
        </div>

        {aiOpen ? (
          <aside className="ai-panel" aria-label="AI 분석 패널">
            <header>
              <span className="ai-chip">{panel.chip ?? "AI"}</span>
              <h2>{panel.title}</h2>
              <button className="icon-btn" onClick={() => setAiOpen(false)} aria-label="AI 패널 닫기">
                {window.innerWidth <= 900 ? <X size={18} /> : <PanelRight size={18} />}
              </button>
            </header>
            <div className="ai-body">{panel.body}</div>
          </aside>
        ) : (
          <button className="ai-rail" onClick={() => setAiOpen(true)} aria-label="AI 분석 패널 열기">
            <PanelRight size={14} style={{ transform: "rotate(90deg)" }} /> AI 분석 패널
          </button>
        )}
      </div>
      <InferenceBadge />
      <ChatWidget />
    </ShellCtx.Provider>
  );
}
