import { Link } from "react-router-dom";
import { BookText, FileCheck2, Menu, SlidersVertical } from "lucide-react";
import Logo from "../components/Logo";
import SearchBox from "../components/SearchBox";
import ChatWidget from "../components/ChatWidget";
import { useFetch } from "../lib/useFetch";
import type { Quote } from "../lib/api";
import { arrow, dir, fmtPrice } from "../lib/format";
import { useState } from "react";

const TAGS = ["ETF", "총보수", "배당", "장기투자"];

export default function Landing() {
  const { data } = useFetch<{ asOf: string; quotes: Quote[] }>("/market/summary");
  const [q, setQ] = useState("");
  const rows = (data?.quotes ?? []).filter((x) => x.code !== "NDX");

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-grid" aria-hidden />
        <HeroLines />
        <div className="l-nav">
          <div className="left">
            <Link to="/"><Logo /></Link>
            <nav aria-label="주요 메뉴">
              <Link to="/app/learn">참고서</Link>
              <Link to="/app/etf">종목·ETF</Link>
              <Link to="/app/ask">AI 분석</Link>
              <Link to="/app/reports">보고서 평가</Link>
            </nav>
          </div>
          <div className="right">
            <Link to="/login" className="btn btn-ghost-dark" style={{ height: 44 }}>로그인</Link>
            <Link to="/app/dashboard" className="icon-btn" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.28)", height: 44, width: 44 }} aria-label="메뉴 열기">
              <Menu size={20} />
            </Link>
          </div>
        </div>
        <div className="hero-body">
          <div>
            <h1>데이터로 읽고,<br />AI와 함께 배우는<br />주식 참고서</h1>
            <p className="lead">국내·해외 주식과 ETF를 용어부터 분석 리포트까지. 근거 문서를 보여 주는 AI가 옆에서 설명합니다.</p>
            <div className="ctas">
              <Link to="/login" className="btn btn-primary btn-lg">무료로 시작하기</Link>
              <Link to="/app/dashboard" className="btn btn-ghost-dark btn-lg">둘러보기</Link>
            </div>
          </div>
          <div className="market-card" aria-label="오늘의 시장">
            <div className="cap">오늘의 시장 · {data?.asOf ?? "--:--"} 기준</div>
            {rows.length
              ? rows.map((r) => (
                  <Link to={r.code === "SPX" ? "/app/etf/SNP500" : "/app/dashboard"} className="market-row" key={r.code}>
                    <span>{r.name}</span>
                    <span className={`v num ${dir(r.changePct)}`}>
                      {fmtPrice(r.last, r.unit)} {arrow(r.changePct)}{Math.abs(r.changePct).toFixed(2)}%
                    </span>
                  </Link>
                ))
              : [0, 1, 2, 3].map((i) => <div key={i} className="market-row"><span className="skeleton" style={{ width: 60, height: 14, opacity: 0.2 }} /></div>)}
          </div>
        </div>
      </section>

      <section className="search-band">
        <div>
          <h2>궁금한 종목이나 용어를 찾아보세요</h2>
          <div className="tags">
            {TAGS.map((t) => (
              <button key={t} onClick={() => setQ(t)}>#{t}</button>
            ))}
          </div>
        </div>
        <SearchBox variant="hero" initial={q} placeholder="예: 미국 S&P500 ETF 총보수 비교" />
      </section>

      <section className="three">
        <div>
          <h2>처음 투자하는 사람에게<br />필요한 세 가지</h2>
          <p>용어를 이해하고, 데이터를 보고, 내 판단을 점검합니다. 한 화면에 몰아넣지 않고 단계별 페이지로 나눴습니다.</p>
        </div>
        <Link to="/app/learn" className="feature dark">
          <span className="ic"><BookText size={24} /></span>
          <span><h3>참고서로 배우기</h3><small>용어 사전과 배경지식 7개 시리즈</small></span>
        </Link>
        <Link to="/app/etf/SNP500" className="feature">
          <span className="ic"><SlidersVertical size={24} /></span>
          <span><h3>AI로 분석하기</h3><small>차트, 예측 구간, Agent 해설</small></span>
        </Link>
        <Link to="/app/reports" className="feature">
          <span className="ic"><FileCheck2 size={24} /></span>
          <span><h3>보고서 평가받기</h3><small>근거와 위험 설명을 점수로 확인</small></span>
        </Link>
      </section>

      <footer className="l-foot">
        <span>시장노트 팀 프로젝트 · 사업자 정보 영역</span>
        <span>모든 정보는 학습용이며 투자 권유가 아닙니다. ETF·지수 수치는 예시 데이터이고, 기업 분석은 P02·P04 Agent의 검증 전 결과입니다.</span>
      </footer>
      <ChatWidget />
    </div>
  );
}

/** 히어로 배경의 장식용 선 (레퍼런스 01의 보라색 꺾은선) */
function HeroLines() {
  return (
    <svg className="hero-lines" viewBox="0 0 1440 640" preserveAspectRatio="none" aria-hidden>
      <polyline points="0,560 160,520 480,470 640,490 800,400 960,420 1100,330 1440,260" fill="none" stroke="#5b4df5" strokeWidth="3" />
      <polyline points="0,600 300,560 640,575 960,540 1280,500 1440,430" fill="none" stroke="#5b4df5" strokeOpacity=".45" strokeWidth="2" />
      <polyline points="0,520 400,430 700,470 1000,380 1440,300" fill="none" stroke="#5b4df5" strokeOpacity=".18" strokeWidth="2" />
    </svg>
  );
}
