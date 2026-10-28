"""DB를 읽는 도구들. 수치는 모두 EvidenceLedger에 등록하고 ID를 함께 돌려줍니다."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from ..config import FINANCIAL_METRICS, VALUATION_COLUMNS, Settings, get_settings
from ..db import Database
from ..evidence import EvidenceLedger, to_float
from .sql_guard import validate_sql


# ---------------------------------------------------------------- 종목 찾기
def find_company(db: Database, query: str) -> dict | None:
    """티커(005930, NVDA) 또는 이름(삼성전자)으로 종목 마스터를 찾는다."""
    q = query.strip()
    rows = db.query(
        """
        SELECT company_id, market, ticker, name, sector, sector_desc
        FROM core.company
        WHERE ticker = %(q)s OR upper(ticker) = upper(%(q)s) OR name ILIKE %(like)s
        ORDER BY (ticker = %(q)s) DESC, (name = %(q)s) DESC, length(name)
        LIMIT 5
        """,
        {"q": q, "like": f"%{q}%"},
    )
    return rows[0] if rows else None


def _money_unit(company: dict) -> str:
    return "USD" if str(company.get("market", "")).upper() == "US" else "원"


# ---------------------------------------------------------------- ② Peer 비교
def get_peer_group(db: Database, company_id: Any) -> dict:
    rows = db.query(
        """
        SELECT pg.peer_group_id, pg.method, pm.company_id, pm.rank, pm.reason,
               c.name, c.ticker, c.market, c.sector
        FROM core.peer_group pg
        JOIN core.peer_member pm ON pm.peer_group_id = pg.peer_group_id
        JOIN core.company c ON c.company_id = pm.company_id
        WHERE pg.base_company_id = %(cid)s
        ORDER BY pm.rank
        """,
        {"cid": company_id},
    )
    method = rows[0]["method"] if rows else None
    return {"method": method, "members": rows}


def get_valuation(db: Database, ledger: EvidenceLedger, companies: list[dict]) -> list[dict]:
    """core.v_valuation 을 읽어 비교표 행을 만들고, 각 수치를 증거로 등록한다."""
    ids = [c["company_id"] for c in companies]
    if not ids:
        return []
    rows = db.query("SELECT * FROM core.v_valuation WHERE company_id = ANY(%(ids)s)", {"ids": ids})
    by_id = {r["company_id"]: r for r in rows}
    table = []
    for c in companies:
        r = by_id.get(c["company_id"])
        out = {"기업": c["name"], "티커": c["ticker"]}
        if r is None:
            out["비고"] = "데이터 없음"
            table.append(out)
            continue
        as_of = r.get("as_of") or r.get("trade_date")
        for col, (label, unit) in VALUATION_COLUMNS.items():
            if col not in r:
                continue
            u = _money_unit(c) if unit == "원" else unit
            ev = ledger.add(f"{c['name']} {label}", r[col], u, "core.v_valuation", {"company_id": c["company_id"]}, as_of)
            out[label] = f"{ev.display} [{ev.id}]" if ev else "-"
        table.append(out)
    return table


# ---------------------------------------------------------------- 재무 (TTM)
def get_financials(db: Database, ledger: EvidenceLedger, company: dict) -> dict[str, float]:
    """core.financial_quarter 에서 최근 4개 분기로 TTM(흐름)과 최근 분기(잔액)를 구한다."""
    metrics = [m["metric"] for m in FINANCIAL_METRICS.values()]
    rows = db.query(
        """
        SELECT metric, period_end, amount
        FROM core.financial_quarter
        WHERE company_id = %(cid)s AND metric = ANY(%(metrics)s)
        ORDER BY period_end DESC
        """,
        {"cid": company["company_id"], "metrics": metrics},
    )
    by_metric: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_metric[r["metric"]].append(r)

    unit = _money_unit(company)
    values: dict[str, float] = {}
    for key, spec in FINANCIAL_METRICS.items():
        series = by_metric.get(spec["metric"], [])
        if not series:
            continue
        if spec["kind"] == "flow":
            last4 = series[:4]
            if len(last4) < 4:
                continue  # 4개 분기가 없으면 TTM을 만들지 않는다
            val = sum(to_float(r["amount"]) or 0.0 for r in last4)
            label = f"{company['name']} {spec['label']}(TTM)"
        else:
            val = to_float(series[0]["amount"])
            label = f"{company['name']} {spec['label']}"
        if val is None:
            continue
        ev = ledger.add(label, val, unit, "core.financial_quarter", {"company_id": company["company_id"], "metric": spec["metric"]}, series[0]["period_end"])
        values[key] = val
        values[f"{key}__id"] = ev.id  # type: ignore[assignment]
    return values


# ---------------------------------------------------------------- ① 공시
def get_disclosures(db: Database, company_id: Any, days: int = 30, limit: int = 20) -> list[dict]:
    return db.query(
        """
        SELECT rcept_no, report_nm, rcept_dt, category, event_type, url
        FROM core.disclosure
        WHERE company_id = %(cid)s AND rcept_dt >= current_date - %(days)s::int
        ORDER BY rcept_dt DESC
        LIMIT %(limit)s
        """,
        {"cid": company_id, "days": days, "limit": limit},
    )


def get_new_disclosures(db: Database, hours: int = 24) -> list[dict]:
    """모니터링용: 최근 N시간 안에 들어온 공시 (전 종목)."""
    return db.query(
        """
        SELECT d.company_id, c.name, c.ticker, d.rcept_no, d.report_nm, d.rcept_dt, d.event_type, d.url
        FROM core.disclosure d JOIN core.company c ON c.company_id = d.company_id
        WHERE d.rcept_dt >= (now() - make_interval(hours => %(hours)s))::date
        ORDER BY d.rcept_dt DESC
        LIMIT 200
        """,
        {"hours": hours},
    )


# ---------------------------------------------------------------- 5개 관점 지표
def get_features(db: Database, ledger: EvidenceLedger, company: dict) -> list[dict]:
    rows = db.query(
        """
        SELECT perspective, feature, value, unit, note, as_of
        FROM core.feature_snapshot
        WHERE company_id = %(cid)s
          AND as_of = (SELECT max(as_of) FROM core.feature_snapshot WHERE company_id = %(cid)s)
        ORDER BY perspective, feature
        """,
        {"cid": company["company_id"]},
    )
    out = []
    for r in rows:
        ev = ledger.add(f"{company['name']} {r['feature']}", r["value"], r.get("unit") or "", "core.feature_snapshot",
                        {"company_id": company["company_id"], "feature": r["feature"]}, r.get("as_of"))
        out.append({"관점": r["perspective"], "지표": r["feature"], "값": f"{ev.display} [{ev.id}]" if ev else "-", "메모": r.get("note") or ""})
    return out


# ---------------------------------------------------------------- RAG 검색
def search_documents(db: Database, ledger: EvidenceLedger, query: str, company_id: Any = None, k: int = 5,
                     query_embedding: list[float] | None = None) -> list[dict]:
    """임베딩이 있으면 pgvector 유사도, 없으면 제목·요약 키워드 검색 (rag.chunk 적재 전 대체 경로)."""
    if query_embedding is not None:
        rows = db.query(
            """
            SELECT d.doc_id, d.title, d.url, d.source, d.published_at, ch.content AS summary
            FROM rag.chunk ch JOIN rag.document d ON d.doc_id = ch.doc_id
            WHERE (%(cid)s::text IS NULL OR d.company_id::text = %(cid)s::text)
            ORDER BY ch.embedding <=> %(emb)s::vector
            LIMIT %(k)s
            """,
            {"cid": company_id, "emb": str(query_embedding), "k": k},
        )
    else:
        terms = [t for t in query.split() if len(t) >= 2][:5] or [query]
        like = "|".join(terms)
        rows = db.query(
            """
            SELECT doc_id, title, url, source, published_at, summary
            FROM rag.document
            WHERE (%(cid)s::text IS NULL OR company_id::text = %(cid)s::text)
              AND (title ~* %(pat)s OR coalesce(summary, '') ~* %(pat)s)
            ORDER BY published_at DESC NULLS LAST
            LIMIT %(k)s
            """,
            {"cid": company_id, "pat": like, "k": k},
        )
    docs = []
    for r in rows:
        ev = ledger.add_doc(r["title"], r.get("url"), r.get("source") or "rag.document", r.get("published_at"), r.get("summary"))
        docs.append({"id": ev.id, "title": r["title"], "url": r.get("url"), "source": r.get("source"), "published_at": ev.as_of})
    return docs


# ---------------------------------------------------------------- Text-to-SQL
def run_sql(db: Database, ledger: EvidenceLedger, sql: str, settings: Settings | None = None, register: bool = True) -> dict:
    """LLM이 만든 SELECT를 안전 검사 후 실행. 숫자 칸은 증거로 등록한다."""
    s = settings or get_settings()
    safe = validate_sql(sql, s.sql_row_limit)
    rows = db.query(safe)
    if register:
        for i, r in enumerate(rows[:50]):  # 증거는 50행까지만
            name = r.get("name") or r.get("ticker") or r.get("company_id") or f"row{i + 1}"
            for col, v in r.items():
                if col in ("company_id", "rcept_no", "doc_id", "fiscal_year", "fiscal_q") or isinstance(v, bool):
                    continue
                if to_float(v) is not None and not isinstance(v, str):
                    ev = ledger.add(f"{name} {col}", v, "", "sql", {"row": i, "column": col})
                    r[col] = f"{v} [{ev.id}]"
    return {"sql": safe, "rows": rows}
