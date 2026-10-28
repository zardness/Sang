"""③ 리스크 심사: 재무 건전성 등급과 체크리스트.

지금은 규칙 기반 기준선(baseline)입니다. 모델 담당이 분류 모델을 학습하면
models/health_model.joblib 로 저장하고 `predict_with_model` 이 그 결과를 함께 보여 줍니다.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from ..config import RISK_EVENT_TYPES, RISK_RULES
from ..db import Database
from ..evidence import EvidenceLedger
from .data import get_disclosures, get_financials

GRADES = ("우량", "보통", "주의")
MODEL_PATH = os.getenv("HEALTH_MODEL_PATH", "models/health_model.joblib")


@dataclass
class CheckItem:
    name: str
    status: str  # 통과 | 경고 | 위험 | 데이터 없음
    detail: str
    evidence_ids: list[str] = field(default_factory=list)


@dataclass
class HealthResult:
    grade: str
    method: str
    checklist: list[CheckItem]
    risk_disclosures: list[dict]
    model_proba: dict[str, float] | None = None


def _ratio_evidence(ledger: EvidenceLedger, label: str, value: float, unit: str, parts: list[str], company: dict):
    return ledger.add(f"{company['name']} {label}", value, unit, "계산: " + " / ".join(parts), {"company_id": company["company_id"]})


def health_check(db: Database, ledger: EvidenceLedger, company: dict) -> HealthResult:
    fin = get_financials(db, ledger, company)
    items: list[CheckItem] = []

    # 1) 자본잠식: 자본총계 < 자본금(부분), 자본총계 < 0(완전)
    eq, cap = fin.get("total_equity"), fin.get("paid_in_capital")
    if eq is None or cap is None:
        items.append(CheckItem("자본잠식", "데이터 없음", "자본총계 또는 자본금 값이 없습니다."))
    else:
        ids = [fin["total_equity__id"], fin["paid_in_capital__id"]]
        if eq < 0:
            items.append(CheckItem("자본잠식", "위험", f"완전 자본잠식: 자본총계가 음수입니다 [{ids[0]}].", ids))
        elif eq < cap:
            items.append(CheckItem("자본잠식", "위험", f"부분 자본잠식: 자본총계 [{ids[0]}] 가 자본금 [{ids[1]}] 보다 작습니다.", ids))
        else:
            items.append(CheckItem("자본잠식", "통과", f"자본총계 [{ids[0]}] 가 자본금 [{ids[1]}] 이상입니다.", ids))

    # 2) 이자보상배율 = 영업이익(TTM) / 이자비용(TTM)
    op, ie = fin.get("operating_income"), fin.get("interest_expense")
    if op is None or not ie:
        items.append(CheckItem("이자보상배율", "데이터 없음", "영업이익 또는 이자비용(TTM) 값이 없습니다."))
    else:
        icr = op / ie
        ev = _ratio_evidence(ledger, "이자보상배율", icr, "배", [fin["operating_income__id"], fin["interest_expense__id"]], company)
        bad = icr < RISK_RULES["interest_coverage_critical"]
        items.append(CheckItem("이자보상배율", "위험" if bad else "통과",
                               f"이자보상배율 {ev.display} [{ev.id}], 기준 {RISK_RULES['interest_coverage_critical']:.1f}배", [ev.id]))

    # 3) 부채비율 = 부채총계 / 자본총계 × 100
    li = fin.get("total_liabilities")
    if li is None or not eq or eq <= 0:
        items.append(CheckItem("부채비율", "데이터 없음", "부채총계 또는 양의 자본총계가 없습니다."))
    else:
        dr = li / eq * 100
        ev = _ratio_evidence(ledger, "부채비율", dr, "%", [fin["total_liabilities__id"], fin["total_equity__id"]], company)
        warn = dr > RISK_RULES["debt_ratio_warn"]
        items.append(CheckItem("부채비율", "경고" if warn else "통과",
                               f"부채비율 {ev.display} [{ev.id}], 경고 기준 {RISK_RULES['debt_ratio_warn']:.1f}%", [ev.id]))

    # 4) 영업적자(TTM)
    if op is not None:
        eid = fin["operating_income__id"]
        items.append(CheckItem("영업손익(TTM)", "경고" if op < 0 else "통과",
                               f"최근 4개 분기 영업이익 합계 [{eid}] 가 {'적자' if op < 0 else '흑자'}입니다.", [eid]))

    # 5) 최근 1년 리스크 공시
    days = RISK_RULES["risk_event_lookback_days"]
    disc = get_disclosures(db, company["company_id"], days=days, limit=100)
    risky = [d for d in disc if (d.get("event_type") or "") in RISK_EVENT_TYPES]
    items.append(CheckItem("리스크 공시(최근 1년)", "경고" if risky else "통과",
                           f"유상증자·CB·소송 등 리스크 유형 공시 {len(risky)}건" if risky else "리스크 유형 공시가 없습니다."))

    # 6) 감사의견: 현재 DB에 컬럼이 없어 확인 항목으로 남긴다
    items.append(CheckItem("감사의견", "데이터 없음", "감사의견 적재 전입니다. DART 정기보고서 주요정보로 추가 예정."))

    statuses = {i.status for i in items}
    grade = "주의" if "위험" in statuses else "보통" if "경고" in statuses else "우량"
    result = HealthResult(grade, "규칙 기반 기준선", items, risky)

    proba = predict_with_model(fin)
    if proba:
        result.model_proba = proba
        result.method = "규칙 기반 + 분류 모델"
    return result


def predict_with_model(features: dict[str, Any]) -> dict[str, float] | None:
    """학습된 분류 모델이 있으면 등급 확률을 돌려준다. 없으면 None."""
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        import joblib  # type: ignore

        bundle = joblib.load(MODEL_PATH)  # {"model": clf, "features": [...], "classes": [...]}
        x = [[features.get(f) or 0.0 for f in bundle["features"]]]
        p = bundle["model"].predict_proba(x)[0]
        return {str(c): float(v) for c, v in zip(bundle["classes"], p)}
    except Exception:  # 모델 문제로 보고서가 멈추지 않게
        return None
