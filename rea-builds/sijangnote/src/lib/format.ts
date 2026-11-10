export const fmt = (v: number, digits = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtPrice = (v: number, unit: string | null) => (unit === "원" ? `${Math.round(v).toLocaleString("ko-KR")}원` : fmt(v));
export const dir = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
export const arrow = (v: number) => (v > 0 ? "▲" : v < 0 ? "▼" : "");
export const pct = (v: number, digits = 2) => `${Math.abs(v).toFixed(digits)}%`;
export const won = (v: number) => (v >= 10000 ? `${Math.round(v / 10000).toLocaleString("ko-KR")}만원` : `${Math.round(v).toLocaleString("ko-KR")}원`);
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
