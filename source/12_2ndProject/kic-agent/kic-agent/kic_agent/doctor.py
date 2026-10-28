"""실제 DB 구조가 코드의 기대(config.EXPECTED_COLUMNS)와 맞는지 점검합니다."""
from __future__ import annotations

from .config import EXPECTED_COLUMNS, FINANCIAL_METRICS
from .db import Database


def run_doctor(db: Database) -> list[str]:
    report: list[str] = []
    for table, cols in EXPECTED_COLUMNS.items():
        schema, name = table.split(".")
        rows = db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = %s AND table_name = %s",
            (schema, name),
        )
        have = {r["column_name"] for r in rows}
        if not have:
            report.append(f"[없음] {table} 테이블/뷰를 찾지 못했습니다.")
            continue
        missing = [c for c in cols if c not in have]
        if missing:
            report.append(f"[불일치] {table}: 없는 컬럼 {missing} / 실제 컬럼 {sorted(have)}")
        else:
            report.append(f"[OK] {table}")

    metrics = {r["metric"] for r in db.query("SELECT DISTINCT metric FROM core.financial_quarter LIMIT 500")}
    for key, spec in FINANCIAL_METRICS.items():
        mark = "OK" if spec["metric"] in metrics else "불일치"
        report.append(f"[{mark}] financial_quarter.metric '{spec['metric']}' ({key})")
    if metrics:
        report.append(f"      실제 metric 값 예시: {sorted(metrics)[:30]}")

    n = db.query("SELECT count(*) AS n FROM rag.chunk WHERE embedding IS NOT NULL")
    report.append(f"[정보] 임베딩이 있는 rag.chunk 행: {n[0]['n'] if n else 0} (0이면 RAG는 키워드 검색으로 동작)")
    return report
