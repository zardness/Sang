"""Neon 조회 → 입력 변환 → 품질 검사까지 한 번에. 두 Agent 노트북이 같은 준비 단계를 쓴다."""
from dataclasses import dataclass, field

from agent.neon_quality import merge_gates, raw_checks
from agent.neon_report import build_report, today_kst
from agent.neon_source import fetch_bundle
from agent.quality_gate import assess_report


@dataclass
class Prepared:
    bundle: dict
    report: dict
    gates: dict
    raw: list = field(default_factory=list)
    report_checks: list = field(default_factory=list)


def prepare(conn, ticker, *, start, end, window=20, price_rows=250, market='KR', reference_date=None,
            price_adjustment=None, price_source_note=None, max_price_age_days=5, max_doc_age_days=400,
            max_documents=15, max_disclosures=30):
    """한 종목 준비. reference_date(검사 기준일)는 기본 KST 오늘."""
    ref = reference_date or today_kst()
    bundle = fetch_bundle(conn, ticker, start=start, end=end, market=market,
                          max_documents=max_documents, max_disclosures=max_disclosures)
    report = build_report(bundle, window=window, price_rows=price_rows, price_adjustment=price_adjustment,
                          price_source_note=price_source_note)
    gates, checks = assess_report(report, window=window, reference_date=ref,
                                  max_price_age_days=max_price_age_days, max_doc_age_days=max_doc_age_days)
    raw = raw_checks(bundle, window=window, reference_date=ref, max_price_age_days=max_price_age_days)
    return Prepared(bundle=bundle, report=report, gates=merge_gates(gates, raw), raw=raw, report_checks=checks)
