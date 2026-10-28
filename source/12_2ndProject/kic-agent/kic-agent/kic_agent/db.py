"""DB 접근 계층. Agent는 읽기만 하므로 연결마다 읽기 전용으로 설정합니다."""
from __future__ import annotations

from typing import Any, Protocol

from .config import Settings, get_settings


class Database(Protocol):
    def query(self, sql: str, params: Any = None) -> list[dict]: ...


class PostgresDB:
    """Neon Postgres 연결. psycopg 3 사용."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        if not self.settings.database_url:
            raise RuntimeError("DATABASE_URL 이 없습니다. .env 에 Neon 연결 문자열을 넣어 주세요.")
        self._conn = None

    def _connect(self):
        import psycopg
        from psycopg.rows import dict_row

        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self.settings.database_url, row_factory=dict_row, autocommit=True)
            with self._conn.cursor() as cur:
                cur.execute("SET default_transaction_read_only = on")
                cur.execute(f"SET statement_timeout = {int(self.settings.statement_timeout_ms)}")
        return self._conn

    def query(self, sql: str, params: Any = None) -> list[dict]:
        conn = self._connect()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description is None:
                return []
            return [dict(r) for r in cur.fetchall()]

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
