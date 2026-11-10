import { Fragment } from "react";

/** **굵게** 만 지원하는 아주 작은 렌더러 (HTML 삽입 없이 안전하게) */
export default function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
