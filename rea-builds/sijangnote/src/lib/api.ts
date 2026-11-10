export type Quote = { code: string; name: string; kind: string; region: string; last: number; change: number; changePct: number; unit: string | null };
export type Point = { date: string; close: number };
export type Briefing = { kind: string; title: string; body: string; link: string };
export type Criterion = { key: string; label: string; score: number; max: number; signals: string[] };
export type Finding = { severity: string; criterion: string; title: string; body: string; current: string | null; suggestion: string };
export type Report = { id: number; title: string; kind: string; created: string; text: string; evaluation: { total: number; criteria: Criterion[]; findings: Finding[]; inferred: string[] }; history: { at: string; total: number }[] };
export type Source = { id: string; title: string; source: string; snippet: string; score: number; link: string | null };
export type AskResult = { id: number; question: string; steps: string[]; answer: string; sources: Source[]; quotes: Quote[]; docCount: number; inferred: string };
export type Learning = { total: number; done: number; current: { id: string; ord: number; title: string }; remainingMin: number; chapters: { id: string; ord: number; title: string; done: boolean }[] };
export type Inference = { id: string; area: string; claim: string; evidence: string; confidence: string; alternative: string; screens: string[] };

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // 단일 HTML(VITE_STANDALONE)에서는 같은 서버 코드를 브라우저 안에서 직접 호출한다
  const go = import.meta.env.VITE_STANDALONE ? (await import("../../standalone/backend")).localFetch : fetch;
  const res = await go(`/api${path}`, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });
