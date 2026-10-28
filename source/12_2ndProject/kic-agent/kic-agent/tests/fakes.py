"""DB 없이 테스트하기 위한 가짜 DB. SQL 문자열의 테이블 이름으로 응답을 고른다."""
from __future__ import annotations

from datetime import date

COMPANIES = [
    {"company_id": 1, "market": "KR", "ticker": "005930", "name": "삼성전자", "sector": "반도체", "sector_desc": "메모리·파운드리"},
    {"company_id": 2, "market": "KR", "ticker": "000660", "name": "SK하이닉스", "sector": "반도체", "sector_desc": "메모리"},
    {"company_id": 3, "market": "US", "ticker": "MU", "name": "Micron", "sector": "Semiconductors", "sector_desc": "Memory"},
]
VALUATION = [
    {"company_id": 1, "as_of": date(2026, 10, 23), "market_cap": 4.2e14, "per": 14.3, "pbr": 1.31, "op_margin": 15.2, "roe": 9.1, "debt_ratio": 27.5},
    {"company_id": 2, "as_of": date(2026, 10, 23), "market_cap": 1.6e14, "per": 9.8, "pbr": 2.05, "op_margin": 38.4, "roe": 24.6, "debt_ratio": 55.1},
    {"company_id": 3, "as_of": date(2026, 10, 23), "market_cap": 1.4e11, "per": 21.7, "pbr": 2.4, "op_margin": 22.0, "roe": 11.8, "debt_ratio": 31.0},
]
PEERS = [
    {"peer_group_id": 10, "method": "업종 테마 + 시가총액", "company_id": 2, "rank": 1, "reason": "같은 메모리 반도체, 국내 시총 상위", "name": "SK하이닉스", "ticker": "000660", "market": "KR", "sector": "반도체"},
    {"peer_group_id": 10, "method": "업종 테마 + 시가총액", "company_id": 3, "rank": 2, "reason": "글로벌 메모리 경쟁사", "name": "Micron", "ticker": "MU", "market": "US", "sector": "Semiconductors"},
]
Q = [date(2026, 6, 30), date(2026, 3, 31), date(2025, 12, 31), date(2025, 9, 30)]


def fin_rows(company_id: int) -> list[dict]:
    rows = []
    for i, d in enumerate(Q):
        rows += [
            {"metric": "revenue", "period_end": d, "amount": 75e12 + i * 1e12},
            {"metric": "operating_income", "period_end": d, "amount": 10e12},
            {"metric": "interest_expense", "period_end": d, "amount": 0.2e12},
        ]
    rows += [
        {"metric": "total_liabilities", "period_end": Q[0], "amount": 100e12},
        {"metric": "total_equity", "period_end": Q[0], "amount": 380e12},
        {"metric": "capital_stock", "period_end": Q[0], "amount": 0.9e12},
    ]
    return rows


DISCLOSURES = [
    {"rcept_no": "20261020000123", "report_nm": "주요사항보고서(전환사채권발행결정) 제12회", "rcept_dt": date(2026, 10, 20), "category": "주요사항", "event_type": "전환사채", "url": "https://dart.fss.or.kr/x", "company_id": 1, "name": "삼성전자", "ticker": "005930"},
    {"rcept_no": "20261015000456", "report_nm": "분기보고서 (2026.06)", "rcept_dt": date(2026, 10, 15), "category": "정기", "event_type": None, "url": "https://dart.fss.or.kr/y", "company_id": 1, "name": "삼성전자", "ticker": "005930"},
]
DOCS = [
    {"doc_id": 101, "title": "삼성전자 3분기 실적 전망 상향…HBM 비중 40% 기대", "url": "https://news.example/1", "source": "naver_news", "published_at": date(2026, 10, 22), "summary": "HBM 출하 증가"},
]
FEATURES = [
    {"perspective": "sentiment", "feature": "news_sentiment_7d", "value": 0.32, "unit": "", "note": "키워드 사전", "as_of": date(2026, 10, 26)},
]


class FakeDB:
    def __init__(self):
        self.calls: list[str] = []

    def query(self, sql: str, params=None) -> list[dict]:
        s = " ".join(sql.split()).lower()
        self.calls.append(s)
        if "from core.company" in s and "where ticker" in s:
            q = params["q"]
            return [c for c in COMPANIES if c["ticker"].upper() == q.upper() or q in c["name"]][:1]
        if "from core.peer_group" in s:
            return [dict(p) for p in PEERS] if params["cid"] == 1 else []
        if "from core.v_valuation" in s:
            return [dict(v) for v in VALUATION if v["company_id"] in params["ids"]]
        if "from core.financial_quarter" in s:
            return fin_rows(params["cid"])
        if "from core.disclosure d join" in s:
            return [dict(d) for d in DISCLOSURES]
        if "from core.disclosure" in s:
            return [dict(d) for d in DISCLOSURES if d["company_id"] == params["cid"]]
        if "from core.feature_snapshot" in s:
            return [dict(f) for f in FEATURES]
        if "from rag.document" in s:
            return [dict(d) for d in DOCS]
        if s.startswith("select ticker, name, per from core.v_valuation"):
            return [{"ticker": "005930", "name": "삼성전자", "per": 14.3}]
        return []
