"""증거 장부(Evidence Ledger).

도구가 DB에서 가져온 모든 수치는 여기에 [E1], [E2] … ID로 등록됩니다.
보고서 문장은 이 ID를 인용해야 하고, Verifier는 문장의 숫자가 인용한 값과 같은지 확인합니다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float, Decimal)):
        return float(v)
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def format_value(value: float, unit: str = "") -> str:
    """사람이 읽는 표기. 보고서와 LLM 프롬프트 모두 이 표기를 씁니다."""
    if unit == "원":
        a = abs(value)
        if a >= 1e12:
            return f"{value / 1e12:,.1f}조 원"
        if a >= 1e8:
            return f"{value / 1e8:,.0f}억 원"
        return f"{value:,.0f}원"
    if unit == "USD":
        a = abs(value)
        if a >= 1e9:
            return f"${value / 1e9:,.1f}B"
        if a >= 1e6:
            return f"${value / 1e6:,.1f}M"
        return f"${value:,.0f}"
    if unit in ("%", "배"):
        return f"{value:,.1f}{unit}"
    if unit:
        return f"{value:,.2f} {unit}"
    return f"{value:,.2f}"


def _iso(v: Any) -> str | None:
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return None if v is None else str(v)


@dataclass
class Evidence:
    id: str
    label: str
    value: float | None
    unit: str
    source: str  # 테이블·뷰 이름 또는 문서 URL
    key: dict = field(default_factory=dict)  # 행을 다시 찾을 수 있는 키
    as_of: str | None = None
    kind: str = "number"  # number | doc | text
    text: str | None = None  # kind=doc/text 일 때 내용

    @property
    def display(self) -> str:
        if self.kind == "number" and self.value is not None:
            return format_value(self.value, self.unit)
        return self.text or ""

    def prompt_line(self) -> str:
        when = f", 기준 {self.as_of}" if self.as_of else ""
        return f"[{self.id}] {self.label} = {self.display} (출처 {self.source}{when})"


class EvidenceLedger:
    def __init__(self) -> None:
        self._items: dict[str, Evidence] = {}
        self._doc_n = 0

    def add(self, label: str, value: Any, unit: str, source: str, key: dict | None = None, as_of: Any = None) -> Evidence | None:
        num = to_float(value)
        if num is None:
            return None
        eid = f"E{len([e for e in self._items.values() if e.kind == 'number']) + 1}"
        ev = Evidence(eid, label, num, unit, source, key or {}, _iso(as_of))
        self._items[eid] = ev
        return ev

    def add_doc(self, title: str, url: str | None, source: str, published_at: Any = None, summary: str | None = None) -> Evidence:
        self._doc_n += 1
        did = f"D{self._doc_n}"
        ev = Evidence(did, title, None, "", url or source, {"source": source}, _iso(published_at), kind="doc", text=summary or title)
        self._items[did] = ev
        return ev

    def get(self, eid: str) -> Evidence | None:
        return self._items.get(eid)

    def __iter__(self):
        return iter(self._items.values())

    def __len__(self) -> int:
        return len(self._items)

    def numbers(self) -> list[Evidence]:
        return [e for e in self._items.values() if e.kind == "number"]

    def docs(self) -> list[Evidence]:
        return [e for e in self._items.values() if e.kind == "doc"]

    def prompt_block(self) -> str:
        return "\n".join(e.prompt_line() for e in self._items.values())

    def to_rows(self) -> list[dict]:
        return [
            {"ID": e.id, "항목": e.label, "값": e.display, "출처": e.source, "기준일": e.as_of or "", "키": str(e.key)}
            for e in self._items.values()
        ]
