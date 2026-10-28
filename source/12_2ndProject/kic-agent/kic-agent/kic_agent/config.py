"""설정값과 DB 컬럼 매핑.

DB 컬럼·metric 이름은 팀 DB(sql/001~014)에 맞춰야 합니다.
`python -m kic_agent.cli doctor` 를 실행하면 실제 DB와 다른 곳을 알려 줍니다.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

try:  # .env 파일이 있으면 읽는다 (없어도 동작)
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str | None = os.getenv("DATABASE_URL")  # Neon 연결 문자열 (읽기 전용 계정 권장)
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    llm_model: str = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "2000"))
    verify_retries: int = int(os.getenv("VERIFY_RETRIES", "2"))  # 검증 실패 시 재작성 횟수
    sql_row_limit: int = int(os.getenv("SQL_ROW_LIMIT", "200"))
    statement_timeout_ms: int = int(os.getenv("STATEMENT_TIMEOUT_MS", "15000"))


def get_settings() -> Settings:
    return Settings()


# ---------------------------------------------------------------------------
# core.v_valuation 의 컬럼 → (표시 이름, 단위)
# 실제 뷰의 컬럼명과 다르면 왼쪽 키만 고치면 됩니다.
# 단위 "원"은 조/억으로, "%"·"배"는 소수 1자리로 표시합니다.
# ---------------------------------------------------------------------------
VALUATION_COLUMNS: dict[str, tuple[str, str]] = {
    "market_cap": ("시가총액", "원"),
    "per": ("PER", "배"),
    "pbr": ("PBR", "배"),
    "op_margin": ("영업이익률", "%"),
    "roe": ("ROE", "%"),
    "debt_ratio": ("부채비율", "%"),
}

# ---------------------------------------------------------------------------
# core.financial_quarter.metric 값 → 논리 이름
# flow = 4개 분기 합(TTM), stock = 최근 분기 값
# ---------------------------------------------------------------------------
FINANCIAL_METRICS: dict[str, dict[str, str]] = {
    "revenue": {"metric": "revenue", "kind": "flow", "label": "매출액"},
    "operating_income": {"metric": "operating_income", "kind": "flow", "label": "영업이익"},
    "net_income": {"metric": "net_income", "kind": "flow", "label": "순이익"},
    "interest_expense": {"metric": "interest_expense", "kind": "flow", "label": "이자비용"},
    "total_liabilities": {"metric": "total_liabilities", "kind": "stock", "label": "부채총계"},
    "total_equity": {"metric": "total_equity", "kind": "stock", "label": "자본총계"},
    "paid_in_capital": {"metric": "capital_stock", "kind": "stock", "label": "자본금"},
}

# core.disclosure.event_type 중 리스크로 보는 값
RISK_EVENT_TYPES: set[str] = {
    "유상증자",
    "전환사채",
    "신주인수권부사채",
    "감자",
    "자사주처분",
    "소송",
    "회생절차",
    "횡령배임",
    "관리종목",
    "감사의견",
}

# 리스크 규칙 기준값
RISK_RULES = {
    "debt_ratio_warn": 200.0,  # 부채비율(%) 초과 시 경고
    "interest_coverage_critical": 1.0,  # 이자보상배율 미만 시 주의
    "risk_event_lookback_days": 365,
}

# Agent가 Text-to-SQL로 조회할 수 있는 스키마 (ops, raw 는 막는다)
ALLOWED_SCHEMAS = ("core", "rag")

# doctor 명령이 확인하는 테이블·컬럼
EXPECTED_COLUMNS: dict[str, list[str]] = {
    "core.company": ["company_id", "market", "ticker", "name", "sector"],
    "core.peer_group": ["peer_group_id", "base_company_id", "method"],
    "core.peer_member": ["peer_group_id", "company_id", "rank", "reason"],
    "core.financial_quarter": ["company_id", "period_end", "metric", "amount"],
    "core.disclosure": ["rcept_no", "company_id", "report_nm", "rcept_dt", "event_type", "url"],
    "core.feature_snapshot": ["company_id", "as_of", "perspective", "feature", "value", "unit"],
    "core.v_valuation": ["company_id", *VALUATION_COLUMNS.keys()],
    "rag.document": ["doc_id", "company_id", "source", "title", "url", "published_at", "summary"],
    "rag.chunk": ["chunk_id", "doc_id", "chunk_idx", "content", "embedding"],
}
