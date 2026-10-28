"""DB 없이 Neon 변환·품질검사·두 Agent 실행을 확인한다. 실행: python -m pytest tests/test_neon_agents.py"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import neon_industry, neon_technical  # noqa: E402
from agent.neon_pipeline import Prepared  # noqa: E402
from agent.neon_quality import merge_gates, raw_checks  # noqa: E402
from agent.neon_report import build_report  # noqa: E402
from agent.neon_source import direct_url  # noqa: E402
from agent.quality_gate import assess_report  # noqa: E402
from agent.research_contract import validate_report  # noqa: E402

REF = '2026-10-28'


def bundle(days=60, jump=False, conflict=False):
    dates = pd.bdate_range(end='2026-10-26', periods=days)
    close = [10000 + 50 * i for i in range(days)]
    if jump:
        close[-5] = close[-6] * 2  # 분할 미조정 같은 급변
    prices = pd.DataFrame({'_date': dates.strftime('%Y-%m-%d'), 'open': close, 'high': [c * 1.01 for c in close],
                           'low': [c * 0.99 for c in close], 'close': close, 'volume': [1000 + i for i in range(days)]})
    quarters = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30']
    fin = pd.DataFrame([{'_date': q, 'metric': m, 'amount': v * (1 + 0.1 * i)}
                        for i, q in enumerate(quarters) for m, v in [('매출액', 100.0), ('영업이익', 20.0)]])
    if conflict:
        fin = pd.concat([fin, pd.DataFrame([{'_date': '2026-06-30', 'metric': '매출액', 'amount': 1.0}])])
    disc = pd.DataFrame([{'_date': '2026-10-20', 'rcept_no': '20261020000001', 'report_nm': '분기보고서', 'url': 'https://dart'}])
    docs = pd.DataFrame([{'document_id': 1, '_date': '2026-10-01', 'title': '사업보고서', 'url': 'https://x',
                          '_excerpt': '메모리 반도체 사업', '_sha256': 'a' * 64}])
    return {'company': {'company_id': 1, 'ticker': '005930', 'name': '삼성전자', 'market': 'KR'},
            'start': '2025-01-01', 'end': '2026-10-27', 'queriedAt': '2026-10-28T10:00:00+09:00', 'role': 'r',
            'notes': [], 'prices': prices, 'financials': fin, 'disclosures': disc, 'documents': docs,
            'documentTextSource': 'rag.document.content', 'financialPublishedColumn': None}


def prepared(b, adjustment='unadjusted', window=20):
    report = build_report(b, window=window, price_adjustment=adjustment)
    gates, checks = assess_report(report, window=window, reference_date=REF)
    raw = raw_checks(b, window=window, reference_date=REF)
    return Prepared(bundle=b, report=report, gates=merge_gates(gates, raw), raw=raw, report_checks=checks)


def test_direct_url():
    assert direct_url(' "postgresql://u:p@ep-a-pooler.x.neon.tech/db" ') == 'postgresql://u:p@ep-a.x.neon.tech/db'


def test_report_valid_and_both_agents_run():
    p = prepared(bundle())
    validate_report(p.report)
    assert p.report['evidence'][0]['evidenceId'] == 'E03'
    yoy = {c['metric']: c['result'] for c in p.report['calculations'] if c['method'] == 'yoy_change'}
    assert yoy['매출액'] == pytest.approx((1.5 / 1.1 - 1) * 100, abs=0.01)
    ind = neon_industry.run(p)
    tech = neon_technical.run(p)
    assert ind['status'] == 'partial' and ind['qualityGate']['status'] == 'partial'
    assert tech['status'] == 'partial'
    names = {c['calculationId'] for c in tech['calculations']}
    assert {'TECH_SMA', 'TECH_EXT_MA20', 'TECH_EXT_RSI14'} <= names
    assert 'TECH_EXT_MA120' not in names  # 60개 관측으로는 계산하지 않음


def test_missing_adjustment_blocks_technical_only():
    p = prepared(bundle(), adjustment=None)
    assert p.gates['technical_analysis']['status'] == 'withheld'
    tech = neon_technical.run(p)
    assert tech['status'] == 'withheld' and tech['calculations'] == []
    assert neon_industry.run(p)['status'] == 'partial'


def test_short_history_blocks():
    p = prepared(bundle(days=10))
    assert p.gates['technical_analysis']['status'] == 'withheld'


def test_raw_checks_flag_jump_and_conflict():
    p = prepared(bundle(jump=True, conflict=True))
    rules = {r['규칙']: r['판정'] for r in p.raw}
    assert rules['raw:price_limit'] == '일부 가능'
    assert rules['raw:fin_conflict'] == '일부 가능'


def test_stale_prices_block():
    b = bundle()
    report = build_report(b, window=20, price_adjustment='unadjusted')
    gates, _ = assess_report(report, window=20, reference_date='2026-12-01')
    merged = merge_gates(gates, raw_checks(b, window=20, reference_date='2026-12-01'))
    assert merged['technical_analysis']['status'] == 'withheld'
