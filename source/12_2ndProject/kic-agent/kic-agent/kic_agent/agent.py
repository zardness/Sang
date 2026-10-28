"""ResearchAgent: Planner → Executor(도구) → Writer → Verifier.

- peer_report  : ② 리서치·Peer 비교 보고서
- risk_review  : ③ 리스크 심사 (건전성 등급 + 체크리스트)
- monitor      : ① 신규 공시 감지 → 리스크 공시 종목에 ③ 자동 실행 + 브리핑 원고
- ask          : 자유 질문 (LLM이 도구를 골라 호출, Text-to-SQL 포함)
LLM 키가 없으면 템플릿 작성기로 동작하므로 DB만 있어도 데모가 됩니다.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable

from .config import Settings, get_settings
from .db import Database
from .evidence import EvidenceLedger
from .glossary import load_terms
from .llm import get_llm
from .modes import Mode, guide_appendix, system_prompt
from .report import Report
from .tools import data as T
from .tools.risk import HealthResult, health_check
from .tools.sql_guard import SQLGuardError
from .verifier import verify_text

DISCLAIMER = "※ 이 보고서는 투자 검토 참고 자료이며 매수·매도 추천이 아닙니다."


class CompanyNotFound(LookupError):
    pass


@dataclass
class Plan:
    task: str
    company: dict
    steps: list[str]


class ResearchAgent:
    def __init__(self, db: Database, settings: Settings | None = None, llm: Any = "auto"):
        self.db = db
        self.s = settings or get_settings()
        self.llm = get_llm(self.s) if llm == "auto" else llm

    # ------------------------------------------------------------ Planner
    def plan(self, task: str, query: str) -> Plan:
        company = T.find_company(self.db, query)
        if company is None:
            raise CompanyNotFound(f"'{query}' 에 해당하는 종목을 찾지 못했습니다. 티커(예: 005930)로 다시 시도해 주세요.")
        steps = {
            "peer": ["Peer 그룹 조회", "밸류에이션 비교", "5개 관점 지표", "관련 문서 검색", "보고서 작성", "검증"],
            "risk": ["재무 TTM 계산", "건전성 규칙 점검", "리스크 공시 확인", "모델 확률(있으면)", "의견서 초안", "검증"],
        }[task]
        return Plan(task, company, steps)

    # ------------------------------------------------------------ ② Peer 비교
    def peer_report(self, query: str, mode: Mode = Mode.EXPERT) -> Report:
        plan = self.plan("peer", query)
        c = plan.company
        ledger = EvidenceLedger()
        peer = T.get_peer_group(self.db, c["company_id"])
        members = [m for m in peer["members"] if m["company_id"] != c["company_id"]]
        table = T.get_valuation(self.db, ledger, [c, *members])
        features = T.get_features(self.db, ledger, c)
        docs = T.search_documents(self.db, ledger, f"{c['name']} 실적 전망", c["company_id"], k=3)

        context = {
            "작업": "Peer 비교 보고서",
            "대상": f"{c['name']}({c['ticker']}), 업종 {c.get('sector') or '-'}",
            "Peer 선정 방법": peer["method"] or "데이터 없음",
            "Peer 목록": [f"{m['name']}({m['ticker']}) - {m.get('reason') or ''}" for m in members],
            "관련 문서": [f"[{d['id']}] {d['title']}" for d in docs],
        }
        template = lambda: self._template_peer(c, members, ledger, docs)  # noqa: E731
        narrative, verification, attempts = self._write(mode, context, ledger, template)

        reasons = [(m["name"], m.get("reason") or "") for m in members]
        labels = " ".join(e.label for e in ledger) + " " + narrative
        rep = Report(
            title=f"{c['name']} Peer 비교 보고서",
            company=c,
            mode=mode.value,
            narrative=narrative + "\n\n" + DISCLAIMER,
            tables={"Peer 비교표": table, "5개 관점 지표": features,
                    "참고 문서": [{"ID": d["id"], "제목": d["title"], "출처": d["source"], "게시일": d["published_at"], "URL": d["url"]} for d in docs]},
            appendix=guide_appendix(mode, labels, reasons),
            ledger=ledger,
            verification=verification,
            attempts=attempts,
        )
        return rep

    # ------------------------------------------------------------ ③ 리스크 심사
    def risk_review(self, query: str, mode: Mode = Mode.EXPERT) -> Report:
        plan = self.plan("risk", query)
        c = plan.company
        ledger = EvidenceLedger()
        hr = health_check(self.db, ledger, c)
        docs = [ledger.add_doc(d["report_nm"], d.get("url"), "core.disclosure", d.get("rcept_dt")) for d in hr.risk_disclosures[:5]]

        context = {
            "작업": "리스크 심사 의견서 초안",
            "대상": f"{c['name']}({c['ticker']})",
            "건전성 등급": f"{hr.grade} ({hr.method})",
            "체크리스트": [f"{i.name}: {i.status} - {i.detail}" for i in hr.checklist],
            "리스크 공시": [f"[{d.id}] {d.label} ({d.as_of})" for d in docs],
            "모델 확률": hr.model_proba or "모델 미적용",
        }
        template = lambda: self._template_risk(c, hr, docs)  # noqa: E731
        narrative, verification, attempts = self._write(mode, context, ledger, template)

        checklist = [{"항목": i.name, "판정": i.status, "내용": i.detail} for i in hr.checklist]
        labels = " ".join(i.name for i in hr.checklist) + " " + narrative
        return Report(
            title=f"{c['name']} 리스크 심사 의견서 (초안)",
            company=c,
            mode=mode.value,
            narrative=narrative + "\n\n" + DISCLAIMER,
            tables={"리스크 체크리스트": checklist,
                    "리스크 공시": [{"ID": d.id, "공시": d.label, "접수일": d.as_of, "URL": d.source} for d in docs]},
            appendix=guide_appendix(mode, labels),
            ledger=ledger,
            verification=verification,
            attempts=attempts,
        )

    # ------------------------------------------------------------ ① 모니터링
    def monitor(self, hours: int = 24, mode: Mode = Mode.EXPERT, max_reviews: int = 3) -> dict:
        from .config import RISK_EVENT_TYPES

        new = T.get_new_disclosures(self.db, hours)
        by_company: dict[str, list[dict]] = {}
        for d in new:
            by_company.setdefault(str(d["company_id"]), []).append(d)
        flagged = [(cid, ds) for cid, ds in by_company.items() if any((d.get("event_type") or "") in RISK_EVENT_TYPES for d in ds)]

        reviews = []
        for cid, ds in flagged[:max_reviews]:
            try:
                reviews.append(self.risk_review(ds[0]["ticker"], mode))
            except CompanyNotFound:
                continue

        lines = [f"최근 {hours}시간 신규 공시 브리핑입니다."]
        for cid, ds in list(by_company.items())[:8]:
            names = ", ".join(sorted({d["report_nm"] for d in ds})[:2])
            risk = " 리스크 유형 공시가 포함돼 있습니다." if any((d.get("event_type") or "") in RISK_EVENT_TYPES for d in ds) else ""
            lines.append(f"{ds[0]['name']}: {names}.{risk}")
        if not by_company:
            lines.append("새로 들어온 공시가 없습니다.")
        return {"disclosures": new, "flagged": [ds[0]["name"] for _, ds in flagged], "reviews": reviews, "briefing": " ".join(lines)}

    # ------------------------------------------------------------ 자유 질문 (도구 사용)
    def ask(self, question: str, mode: Mode = Mode.EXPERT, max_steps: int = 8) -> Report:
        if self.llm is None:
            raise RuntimeError("자유 질문은 LLM 키(ANTHROPIC_API_KEY)가 필요합니다. 보고서 기능은 키 없이도 됩니다.")
        ledger = EvidenceLedger()
        tools, handlers = self._tool_specs(ledger)
        sys = system_prompt(mode) + "\n도구로 필요한 데이터를 먼저 조회한 뒤, 도구 결과의 [E#] 근거만 인용해 답한다."
        messages: list[dict] = [{"role": "user", "content": question}]
        answer = ""
        for _ in range(max_steps):
            resp = self.llm.create(sys, messages, tools)
            messages.append({"role": "assistant", "content": resp.content})
            if resp.stop_reason != "tool_use":
                answer = "".join(b.text for b in resp.content if b.type == "text")
                break
            results = []
            for b in resp.content:
                if b.type != "tool_use":
                    continue
                try:
                    out = handlers[b.name](**b.input)
                    results.append({"type": "tool_result", "tool_use_id": b.id, "content": json.dumps(out, ensure_ascii=False, default=str)[:20000]})
                except (SQLGuardError, CompanyNotFound, KeyError, ValueError) as e:
                    results.append({"type": "tool_result", "tool_use_id": b.id, "content": f"오류: {e}", "is_error": True})
            messages.append({"role": "user", "content": results})

        verification = verify_text(answer, ledger)
        attempts = 1
        while not verification.ok and attempts <= self.s.verify_retries:
            attempts += 1
            messages.append({"role": "user", "content": verification.feedback() + "\n위 문제를 고쳐 답변 전체를 다시 써 주세요. 근거 목록:\n" + ledger.prompt_block()})
            resp = self.llm.create(sys, messages)
            messages.append({"role": "assistant", "content": resp.content})
            answer = "".join(b.text for b in resp.content if b.type == "text")
            verification = verify_text(answer, ledger)
        return Report(title=question, company={}, mode=mode.value, narrative=answer, ledger=ledger,
                      verification=verification, attempts=attempts, appendix=guide_appendix(mode, answer))

    # ------------------------------------------------------------ Writer + Verifier
    def _write(self, mode: Mode, context: dict, ledger: EvidenceLedger, template: Callable[[], str]):
        if self.llm is None:
            text = template()
            return text, verify_text(text, ledger), 1

        prompt = "[작업 정보]\n" + json.dumps(context, ensure_ascii=False, indent=1, default=str) + "\n\n[근거]\n" + ledger.prompt_block()
        text = self.llm.complete(system_prompt(mode), prompt)
        result = verify_text(text, ledger)
        attempts = 1
        while not result.ok and attempts <= self.s.verify_retries:
            attempts += 1
            text = self.llm.complete(system_prompt(mode), prompt + "\n\n[이전 초안]\n" + text + "\n\n" + result.feedback() + "\n문제를 모두 고친 본문 전체를 다시 쓰세요.")
            result = verify_text(text, ledger)
        if not result.ok:  # 끝까지 실패하면 검증된 템플릿 본문으로 대체
            text = template() + "\n\n(LLM 초안이 수치 검증을 통과하지 못해 템플릿 본문으로 대체했습니다.)"
            result = verify_text(text, ledger)
        return text, result, attempts

    # ------------------------------------------------------------ 템플릿 본문 (LLM 없이)
    @staticmethod
    def _template_peer(c: dict, members: list[dict], ledger: EvidenceLedger, docs: list[dict]) -> str:
        lines = [f"**{c['name']}** 를 Peer {len(members)}개 기업과 비교했습니다."]
        for label in ("시가총액", "PER", "PBR", "ROE", "영업이익률", "부채비율"):
            base = next((e for e in ledger.numbers() if e.label == f"{c['name']} {label}"), None)
            if base is None:
                continue
            # 통화가 다른 값(원 vs USD)은 범위 비교에서 뺀다
            peers = [e for e in ledger.numbers() if e.label.endswith(f" {label}") and e.label != base.label and e.unit == base.unit]
            s = f"{label}: {base.display} [{base.id}]"
            if len(peers) >= 2:
                lo, hi = min(peers, key=lambda e: e.value), max(peers, key=lambda e: e.value)
                s += f", Peer 범위 {lo.display} [{lo.id}] ~ {hi.display} [{hi.id}]"
            elif peers:
                s += f", Peer {peers[0].label.rsplit(' ', 1)[0]} {peers[0].display} [{peers[0].id}]"
            lines.append("- " + s)
        if docs:
            lines.append("최근 관련 문서: " + ", ".join(f"{d['title']} [{d['id']}]" for d in docs[:3]) + ".")
        return "\n".join(lines)

    @staticmethod
    def _template_risk(c: dict, hr: HealthResult, docs: list) -> str:
        lines = [f"**{c['name']}** 의 재무 건전성 등급은 **{hr.grade}** 입니다 ({hr.method})."]
        flagged = [i for i in hr.checklist if i.status in ("위험", "경고")]
        if flagged:
            lines.append("주의가 필요한 항목:")
            for i in flagged:
                cites = " ".join(f"[{e}]" for e in i.evidence_ids)
                lines.append(f"- {i.name}: {i.status} {cites}".rstrip())
        else:
            lines.append("규칙 점검에서 위험·경고 항목이 없습니다.")
        missing = [i.name for i in hr.checklist if i.status == "데이터 없음"]
        if missing:
            lines.append("데이터가 없어 확인하지 못한 항목: " + ", ".join(missing) + ".")
        if docs:
            lines.append("최근 리스크 공시: " + ", ".join(f"{d.label} [{d.id}]" for d in docs[:3]) + ".")
        return "\n".join(lines)

    # ------------------------------------------------------------ LLM 도구 정의
    def _tool_specs(self, ledger: EvidenceLedger):
        terms = load_terms()

        def company(query: str):
            c = T.find_company(self.db, query)
            if not c:
                raise CompanyNotFound(query)
            return c

        def peer_comparison(query: str):
            c = company(query)
            peer = T.get_peer_group(self.db, c["company_id"])
            members = [m for m in peer["members"] if m["company_id"] != c["company_id"]]
            return {"company": c, "method": peer["method"], "peers": members,
                    "table": T.get_valuation(self.db, ledger, [c, *members])}

        handlers = {
            "find_company": lambda query: company(query),
            "peer_comparison": peer_comparison,
            "health_check": lambda query: _health_dict(health_check(self.db, ledger, company(query))),
            "recent_disclosures": lambda query, days=30: T.get_disclosures(self.db, company(query)["company_id"], days),
            "search_documents": lambda text, query=None: T.search_documents(self.db, ledger, text, company(query)["company_id"] if query else None),
            "run_sql": lambda sql: T.run_sql(self.db, ledger, sql, self.s),
            "glossary": lambda term: {"term": term, "definition": terms.get(term, "용어 DB에 없음")},
        }
        q = {"type": "object", "properties": {"query": {"type": "string", "description": "종목명 또는 티커"}}, "required": ["query"]}
        tools = [
            {"name": "find_company", "description": "종목명/티커로 core.company 행을 찾는다.", "input_schema": q},
            {"name": "peer_comparison", "description": "Peer 그룹과 밸류에이션 비교표(근거 ID 포함).", "input_schema": q},
            {"name": "health_check", "description": "재무 건전성 등급과 리스크 체크리스트.", "input_schema": q},
            {"name": "recent_disclosures", "description": "최근 공시 목록.", "input_schema": {"type": "object", "properties": {"query": {"type": "string"}, "days": {"type": "integer"}}, "required": ["query"]}},
            {"name": "search_documents", "description": "뉴스·공시 원문 검색(RAG). 근거 ID [D#] 를 돌려준다.", "input_schema": {"type": "object", "properties": {"text": {"type": "string"}, "query": {"type": "string", "description": "종목(선택)"}}, "required": ["text"]}},
            {"name": "run_sql", "description": "core·rag 스키마에 SELECT 조회(Text-to-SQL). 주요 테이블: core.company, core.price_daily, core.financial_quarter, core.v_valuation, core.v_ttm, core.disclosure, core.feature_snapshot, core.peer_group, core.peer_member, rag.document.", "input_schema": {"type": "object", "properties": {"sql": {"type": "string"}}, "required": ["sql"]}},
            {"name": "glossary", "description": "지표·용어 풀이(가이드 모드).", "input_schema": {"type": "object", "properties": {"term": {"type": "string"}}, "required": ["term"]}},
        ]
        return tools, handlers


def _health_dict(hr: HealthResult) -> dict:
    return {"grade": hr.grade, "method": hr.method, "model_proba": hr.model_proba,
            "checklist": [{"name": i.name, "status": i.status, "detail": i.detail} for i in hr.checklist],
            "risk_disclosures": [{"report_nm": d["report_nm"], "rcept_dt": str(d["rcept_dt"])} for d in hr.risk_disclosures]}
