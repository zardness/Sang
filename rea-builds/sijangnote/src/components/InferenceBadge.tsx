import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useFetch } from "../lib/useFetch";
import type { Inference } from "../lib/api";

/**
 * 개발 모드 전용: 지금 화면에 영향을 주는 '추론된 서버 로직' 목록.
 * 프로덕션 빌드에서도 보려면 VITE_SHOW_INFERENCE=1, 개발 모드에서 숨기려면 VITE_SHOW_INFERENCE=0.
 */
export default function InferenceBadge() {
  const flag = import.meta.env.VITE_SHOW_INFERENCE;
  const show = flag ? flag === "1" : import.meta.env.DEV;
  const { pathname } = useLocation();
  const { data } = useFetch<Inference[]>(show ? "/inferences" : null);
  const [open, setOpen] = useState(false);
  if (!show || !data) return null;
  const items = data.filter((i) => i.screens.some((s) => (s === "/" ? pathname === "/" : pathname.startsWith(s))));
  if (!items.length) return null;
  return (
    <>
      <button className="inf-badge" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Sparkles size={14} /> 이 화면의 추론된 로직 {items.length}개
      </button>
      {open && (
        <div className="inf-pop" role="dialog" aria-label="추론된 로직">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h4>화면만으로 알 수 없어 추론한 서버 로직</h4>
            <button onClick={() => setOpen(false)} aria-label="닫기"><X size={16} /></button>
          </div>
          <small className="muted">전체 목록과 근거는 docs/INFERENCE.md 에 있습니다.</small>
          {items.map((i) => (
            <div className="item" key={i.id}>
              <b>{i.id} · {i.area}</b> <span className="inf-tag">확신도 {i.confidence}</span>
              <p>{i.claim}</p>
              <small>근거: {i.evidence}</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
