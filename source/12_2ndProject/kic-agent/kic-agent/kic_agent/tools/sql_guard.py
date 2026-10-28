"""Text-to-SQL 안전장치.

LLM이 만든 SQL은 이 검사를 통과해야만 실행됩니다.
- SELECT / WITH 한 문장만
- 쓰기·DDL·세션 변경 키워드 금지
- core, rag 스키마만 (ops, raw, 시스템 카탈로그 금지)
- LIMIT 이 없으면 자동으로 붙임
DB 연결 자체도 읽기 전용이라 이중으로 막습니다.
"""
from __future__ import annotations

import re

from ..config import ALLOWED_SCHEMAS

FORBIDDEN = re.compile(
    r"\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|copy|call|do|execute|"
    r"set|reset|vacuum|analyze|refresh|listen|notify|lock|comment|security|prepare|deallocate)\b",
    re.IGNORECASE,
)
FORBIDDEN_NAMES = re.compile(r"\b(pg_\w+|information_schema|dblink\w*|lo_\w+)\b", re.IGNORECASE)
ALIAS_REF = re.compile(r"\b(?:from|join)\s+[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\s+(?:as\s+)?([a-z_][a-z0-9_]*)", re.IGNORECASE)
TABLE_REF = re.compile(r"\b(?:from|join)\s+\"?([a-z_][a-z0-9_]*)\"?\s*\.", re.IGNORECASE)


class SQLGuardError(ValueError):
    pass


def _strip(sql: str) -> str:
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return sql.strip()


def _without_strings(sql: str) -> str:
    return re.sub(r"'(?:[^']|'')*'", "''", sql)


def validate_sql(sql: str, row_limit: int = 200) -> str:
    """검사를 통과한 SQL(필요하면 LIMIT 추가)을 돌려준다. 실패하면 SQLGuardError."""
    body = _strip(sql).rstrip(";").strip()
    if not body:
        raise SQLGuardError("빈 SQL 입니다.")
    bare = _without_strings(body)
    if ";" in bare:
        raise SQLGuardError("한 번에 한 문장만 실행할 수 있습니다.")
    if not re.match(r"^\s*(select|with)\b", bare, re.IGNORECASE):
        raise SQLGuardError("SELECT 또는 WITH 로 시작하는 조회문만 허용됩니다.")
    m = FORBIDDEN.search(bare)
    if m:
        raise SQLGuardError(f"허용되지 않는 키워드: {m.group(1)}")
    m = FORBIDDEN_NAMES.search(bare)
    if m:
        raise SQLGuardError(f"시스템 객체는 조회할 수 없습니다: {m.group(1)}")

    # FROM/JOIN 뒤의 "스키마.테이블" 은 허용 스키마여야 한다
    # (extract(year from d.rcept_dt) 처럼 별칭이 오는 경우는 허용)
    aliases = {a.lower() for a in ALIAS_REF.findall(bare)} - {"on", "where", "join", "left", "inner", "group", "order", "limit"}
    for schema in TABLE_REF.findall(bare):
        if schema.lower() not in ALLOWED_SCHEMAS and schema.lower() not in aliases:
            raise SQLGuardError(f"허용되지 않은 스키마: {schema} (허용: {', '.join(ALLOWED_SCHEMAS)})")

    if not re.search(r"\blimit\s+\d+\s*$", bare, re.IGNORECASE):
        body = f"{body}\nLIMIT {int(row_limit)}"
    return body
