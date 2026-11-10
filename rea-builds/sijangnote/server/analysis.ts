import { Instrument, INSTRUMENTS, Point, businessDays, find, quote, series, sliceRange, stats, WATCHLIST } from "./market.js";

const Z90 = 1.2816; // 정규분포 90% 분위수

/**
 * [추론 INF-003 · 확신도 중간] 6개월 예측 밴드.
 * 5년 일간 로그수익률의 평균(μ)·표준편차(σ)로 로그정규 분위수를 만든다.
 * 중앙값 = P·e^{μt}, 밴드 = P·e^{μt ± 1.2816·σ·√t}. 근거: docs/INFERENCE.md
 */
export function forecast(inst: Instrument, horizonDays = 126, stepDays = 5) {
  const hist = sliceRange(series(inst), "5y");
  const s = stats(hist);
  const last = hist[hist.length - 1];
  const start = new Date(last.date + "T00:00:00Z");
  const future = businessDays(new Date(start.getTime() + horizonDays * 1.45 * 86400000), horizonDays * 2)
    .filter((d) => d > last.date)
    .slice(0, horizonDays);
  const out: { date: string; median: number; lo: number; hi: number }[] = [{ date: last.date, median: last.close, lo: last.close, hi: last.close }];
  for (let t = stepDays; t <= future.length; t += stepDays) {
    const m = Math.log(last.close) + s.meanDaily * t;
    const w = Z90 * s.sdDaily * Math.sqrt(t);
    out.push({ date: future[t - 1], median: Math.round(Math.exp(m)), lo: Math.round(Math.exp(m - w)), hi: Math.round(Math.exp(m + w)) });
  }
  return {
    model: "로그정규 분위수 (5년 수익률 기반)",
    modelNote: "원본 화면의 LSTM 대신 설명 가능한 통계 모델로 계산했습니다.",
    inferred: "INF-003",
    horizon: "6개월",
    band: "10%~90%",
    points: out,
  };
}

const level = (v: number, lowMax: number, midMax: number) => (v < lowMax ? "낮음" : v < midMax ? "중간" : "높음");

/** [추론 INF-004 · 확신도 중간] Agent 분석 규칙. 근거: docs/INFERENCE.md */
export function agentAnalysis(inst: Instrument) {
  const e = inst.etf!;
  const hist5 = sliceRange(series(inst), "5y", e.listed);
  const s = stats(hist5);
  const f = forecast(inst);
  const end = f.points[f.points.length - 1];
  const bandWidth = (end.hi - end.lo) / end.median;
  const years = Math.round(hist5.length / 252);

  const lines: string[] = [];
  const rising = s.cagr > 0.05;
  const quick = s.recoveryDays !== null && s.recoveryDays <= 252;
  if (rising && quick) lines.push(`${years}년 동안 꾸준히 올랐고, 하락 구간도 1년 안에 회복했습니다.`);
  else if (rising) lines.push(`${years}년 동안 연평균 ${(s.cagr * 100).toFixed(1)}% 올랐지만, 큰 하락에서 회복하는 데 1년 넘게 걸렸습니다.`);
  else lines.push(`${years}년 수익률이 연 ${(s.cagr * 100).toFixed(1)}%로 낮아 비용과 분배금을 함께 봐야 합니다.`);
  if (e.ter < 0.2 && e.holdings >= 100) lines.push("장기 적립식 학습 사례에 적합합니다.");
  else if (e.holdings < 50) lines.push("구성 종목이 적어 한 업종의 흐름에 크게 흔들릴 수 있습니다.");

  const second = e.overseas
    ? "예측 범위가 넓은 이유는 환율 영향입니다. 해외 ETF는 환율을 함께 보세요."
    : bandWidth > 0.45
      ? "예측 범위가 넓은 이유는 업종 변동성이 크기 때문입니다. 비중을 작게 가져가세요."
      : "예측 범위가 비교적 좁아 지수를 안정적으로 따라가는 편입니다.";

  return {
    inferred: "INF-004",
    summary: [lines.join(" "), second],
    evidence: `근거: 학습 3장 · 시세 ${years}년치 · 예측 모델`,
    tiles: [
      { label: "비용", value: level(e.ter, 0.2, 0.5), detail: `총보수 ${e.ter}%` },
      { label: "분산", value: e.holdings >= 100 ? "높음" : e.holdings >= 30 ? "중간" : "낮음", detail: `구성 ${e.holdings}종목` },
      { label: "변동성", value: level(s.annualVol, 0.12, 0.22), detail: `연 ${(s.annualVol * 100).toFixed(1)}%` },
    ],
    metrics: {
      cagr: s.cagr,
      maxDrawdown: s.maxDrawdown,
      recoveryDays: s.recoveryDays,
      annualVol: s.annualVol,
      bandWidth,
    },
  };
}

/** [추론 INF-002 · 확신도 중간] 대시보드 헤드라인 규칙. */
export function headline() {
  const k = find("KOSPI")!, q = find("KOSDAQ")!;
  const gap = k.changePct - q.changePct;
  if (k.changePct > 0 && gap >= 0.3) return "오늘은 대형주가 시장을 끌어올렸어요";
  if (q.changePct > 0 && gap <= -0.3) return "오늘은 중소형주가 힘을 냈어요";
  if (k.changePct < 0 && q.changePct < 0) return "오늘은 시장이 잠시 쉬어갔어요";
  return "오늘은 시장이 고르게 움직였어요";
}

/** [추론 INF-011 · 확신도 낮음] Agent 브리핑: 규칙으로 모은 알림 목록. */
export function briefings(progress: { chapterTitle: string; remainingMin: number }) {
  const out: { kind: string; title: string; body: string; link: string }[] = [];
  const indices = INSTRUMENTS.filter((i) => i.kind === "index");
  const big = [...indices].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  out.push({ kind: "시장", title: `${big.name} ${sign(big.changePct)}%`, body: `오늘 가장 크게 움직인 지수입니다.`, link: "/app/dashboard" });
  const fx = find("USDKRW")!;
  out.push({ kind: "환율", title: `원/달러 ${fx.last.toLocaleString("ko-KR")}원 (${sign(fx.changePct)}%)`, body: fx.changePct < 0 ? "원화가 강해져 해외 ETF의 원화 수익이 줄 수 있어요." : "원화가 약해져 해외 ETF의 원화 수익이 늘 수 있어요.", link: "/app/learn/etf-101-2" });
  const mover = WATCHLIST.map((c) => find(c)!).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  out.push({ kind: "관심 종목", title: `${mover.name} ${sign(mover.changePct)}%`, body: "관심 종목 중 움직임이 가장 컸어요.", link: `/app/etf/${mover.code}` });
  out.push({ kind: "학습", title: `${progress.chapterTitle}`, body: `${progress.remainingMin}분이면 이 장을 끝낼 수 있어요.`, link: "/app/learn" });
  return out;
}

const sign = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

export function marketSummary() {
  return ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW"].map((c) => quote(find(c)!));
}

export function chartSeries(inst: Instrument, range: string): Point[] {
  return sliceRange(series(inst), range, range === "all" ? inst.etf?.listed : undefined);
}
