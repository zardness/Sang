import { useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "../lib/api";

type FPoint = { date: string; median: number; lo: number; hi: number };

type Props = {
  points: Point[];
  forecast?: FPoint[];
  height?: number;
  color?: string;
  area?: boolean;
  format: (v: number) => string;
  xLabels?: boolean;
  forecastLabel?: string;
  ariaLabel: string;
};

const PAD = { t: 24, r: 8, b: 28, l: 8 };

export default function LineChart({ points, forecast, height = 300, color = "var(--primary)", area = true, format, xLabels, forecastLabel, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const n = points.length;
    const split = forecast?.length ? 0.76 : 1;
    const innerW = w - PAD.l - PAD.r;
    const innerH = height - PAD.t - PAD.b;
    const vals = [...points.map((p) => p.close), ...(forecast ?? []).flatMap((f) => [f.lo, f.hi])];
    let min = Math.min(...vals), max = Math.max(...vals);
    const padV = (max - min) * 0.12 || 1;
    min -= padV; max += padV;
    const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW * split);
    const fx = (j: number) => PAD.l + innerW * split + (forecast!.length <= 1 ? 0 : (j / (forecast!.length - 1)) * innerW * (1 - split));
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * innerH;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join("");
    const areaPath = `${line}L${x(n - 1).toFixed(1)},${PAD.t + innerH}L${x(0).toFixed(1)},${PAD.t + innerH}Z`;
    let band = "", med = "";
    if (forecast?.length) {
      band = forecast.map((f, j) => `${j ? "L" : "M"}${fx(j).toFixed(1)},${y(f.hi).toFixed(1)}`).join("") +
        [...forecast].reverse().map((f, k) => `L${fx(forecast.length - 1 - k).toFixed(1)},${y(f.lo).toFixed(1)}`).join("") + "Z";
      med = forecast.map((f, j) => `${j ? "L" : "M"}${fx(j).toFixed(1)},${y(f.median).toFixed(1)}`).join("");
    }
    const grid = [0.25, 0.5, 0.75, 1].map((t) => PAD.t + t * innerH * 0.92);
    // 연도 라벨: 각 해의 첫 거래일
    const years: { x: number; label: string }[] = [];
    if (xLabels) {
      let lastY = "";
      points.forEach((p, i) => {
        const yy = p.date.slice(0, 4);
        if (yy !== lastY && i > 0 && Number(yy) % 2 === 1) years.push({ x: x(i), label: yy });
        lastY = yy;
      });
      if (years.length && years[0].x < 40) years.shift();
    }
    return { x, fx, y, line, areaPath, band, med, grid, years, split, innerW, innerH };
  }, [points, forecast, w, height, xLabels]);

  if (!points.length)
    return (
      <div className="chart" ref={ref}>
        <div className="skeleton" style={{ height }} />
      </div>
    );

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = e.clientX - r.left - PAD.l;
    const frac = px / (g.innerW * g.split);
    const i = Math.round(frac * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
    if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
    if (e.key === "Escape") setHover(null);
  };

  const hp = hover !== null ? points[hover] : null;
  const todayX = g.x(points.length - 1);
  const gid = `g${Math.round(w)}${points.length}`;

  return (
    <div className="chart" ref={ref} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} tabIndex={0} role="img" aria-label={ariaLabel}>
      <svg height={height} viewBox={`0 0 ${w} ${height}`}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5b4df5" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#5b4df5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.grid.map((gy) => (
          <line key={gy} x1={PAD.l} x2={w - PAD.r} y1={gy} y2={gy} stroke="#eceef5" />
        ))}
        {area && <path d={g.areaPath} fill={`url(#${gid})`} />}
        {g.band && <path d={g.band} fill="#5b4df5" opacity="0.13" />}
        <path d={g.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {g.med && <path d={g.med} fill="none" stroke="#5b4df5" strokeWidth="2.5" strokeDasharray="7 6" />}
        {forecast?.length ? (
          <>
            <line x1={todayX} x2={todayX} y1={PAD.t - 4} y2={height - PAD.b} stroke="#9aa0b8" strokeDasharray="3 4" />
            <circle cx={todayX} cy={g.y(points[points.length - 1].close)} r="5" fill="var(--navy-900)" />
          </>
        ) : null}
        {xLabels && (
          <g fontSize="11" fill="#8a8fa6">
            {g.years.map((yl) => (
              <text key={yl.label} x={yl.x} y={height - 6} textAnchor="middle">{yl.label}</text>
            ))}
            {forecast?.length ? (
              <>
                <text x={todayX} y={height - 6} textAnchor="middle">오늘</text>
                <text x={w - PAD.r - 14} y={height - 6} textAnchor="middle">+6M</text>
              </>
            ) : null}
          </g>
        )}
        {hp && (
          <>
            <line x1={g.x(hover!)} x2={g.x(hover!)} y1={PAD.t - 4} y2={height - PAD.b} stroke="#5b4df5" strokeDasharray="3 4" opacity="0.7" />
            <circle cx={g.x(hover!)} cy={g.y(hp.close)} r="6" fill="#fff" stroke="#5b4df5" strokeWidth="2.5" />
          </>
        )}
      </svg>
      {forecast?.length && forecastLabel ? (
        <span className="pill pill-violet" style={{ position: "absolute", left: todayX + 16, top: 8 }}>{forecastLabel}</span>
      ) : null}
      {hp && (
        <div className="tip" style={{ left: Math.min(g.x(hover!), w - 170), top: g.y(hp.close) }}>
          {Number(hp.date.slice(5, 7))}월 {Number(hp.date.slice(8, 10))}일{hp.date.slice(0, 4) !== new Date().getFullYear().toString() ? ` · ${hp.date.slice(0, 4)}` : ""}
          <b className="num">{format(hp.close)}</b>
        </div>
      )}
    </div>
  );
}
