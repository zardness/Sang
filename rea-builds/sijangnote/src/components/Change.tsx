import { arrow, dir, pct } from "../lib/format";

export default function Change({ value, abs, digits = 2 }: { value: number; abs?: string; digits?: number }) {
  return (
    <span className={`num ${dir(value)}`}>
      {arrow(value)}
      {abs ? `${abs} (${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(value, digits)})` : pct(value, digits)}
    </span>
  );
}
