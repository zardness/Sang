"""보고서 객체와 내보내기 (Markdown, Excel). PDF는 본선 단계에서 추가."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .evidence import EvidenceLedger
from .verifier import VerificationResult


@dataclass
class Report:
    title: str
    company: dict
    mode: str
    narrative: str  # LLM(또는 템플릿)이 쓴 본문: 검증 대상
    tables: dict[str, list[dict]] = field(default_factory=dict)  # 시스템이 증거로 만든 표
    appendix: str = ""  # 가이드 모드 풀이 (숫자 없음)
    ledger: EvidenceLedger = field(default_factory=EvidenceLedger)
    verification: VerificationResult | None = None
    attempts: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))

    @property
    def verified(self) -> bool:
        return bool(self.verification and self.verification.ok)

    def to_markdown(self) -> str:
        badge = "검증 통과" if self.verified else "검증 실패: 수치를 사람이 확인해야 합니다"
        out = [f"# {self.title}", f"_{self.created_at} · 모드: {self.mode} · {badge}_", "", self.narrative.strip()]
        for name, rows in self.tables.items():
            if rows:
                out += ["", f"## {name}", _md_table(rows)]
        if self.appendix:
            out += ["", self.appendix]
        if len(self.ledger):
            out += ["", "## 근거", _md_table([{k: r[k] for k in ("ID", "항목", "값", "출처", "기준일")} for r in self.ledger.to_rows()])]
        if self.verification and not self.verification.ok:
            out += ["", "## 검증 메모", self.verification.feedback()]
        return "\n".join(out)

    def to_excel(self, path: str) -> str:
        from openpyxl import Workbook
        from openpyxl.styles import Font

        wb = Workbook()
        ws = wb.active
        ws.title = "요약"
        ws.append([self.title])
        ws["A1"].font = Font(bold=True, size=14)
        ws.append([f"작성 {self.created_at} · 모드 {self.mode} · {'검증 통과' if self.verified else '검증 실패'}"])
        ws.append([])
        for line in self.narrative.splitlines():
            ws.append([line])
        ws.column_dimensions["A"].width = 120
        for name, rows in {**self.tables, "근거": self.ledger.to_rows()}.items():
            if not rows:
                continue
            sh = wb.create_sheet(name[:31])
            headers = list(dict.fromkeys(k for r in rows for k in r))
            sh.append(headers)
            for c in sh[1]:
                c.font = Font(bold=True)
            for r in rows:
                sh.append([str(r.get(h, "")) for h in headers])
            for i, h in enumerate(headers):
                sh.column_dimensions[chr(65 + i) if i < 26 else "Z"].width = max(12, min(48, len(h) * 2 + 6))
        wb.save(path)
        return path


def _md_table(rows: list[dict]) -> str:
    headers = list(dict.fromkeys(k for r in rows for k in r))
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    for r in rows:
        lines.append("| " + " | ".join(str(r.get(h, "")).replace("|", "/") for h in headers) + " |")
    return "\n".join(lines)
