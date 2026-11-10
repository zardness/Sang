export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 16l5-5 4 3 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="logo-text">시장노트</span>
    </span>
  );
}
