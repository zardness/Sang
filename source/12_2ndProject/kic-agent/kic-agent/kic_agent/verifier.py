"""Verifier: 보고서 문장의 숫자가 인용한 증거와 맞는지 검사합니다.

규칙
1. 숫자가 있는 문장은 [E#] 를 하나 이상 인용해야 한다.
2. 문장의 각 숫자는 인용한 증거 값(표시 단위 변환 포함)과 반올림 오차 안에서 같아야 한다.
3. 존재하지 않는 증거 ID를 인용하면 안 된다.
연도·날짜·분기·순번·개수(5개, 3건 등)는 검사에서 제외한다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .evidence import EvidenceLedger

CITE = re.compile(r"\[([ED]\d+)\]")
NUMBER = re.compile(r"(?<![\w.])[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])[-+]?\d+(?:\.\d+)?")
IGNORE_PATTERNS = [
    r"\[[ED]\d+\]",  # 인용 ID
    r"\d{4}-\d{2}-\d{2}",  # 날짜
    r"\d{4}\s*년(?:\s*\d{1,2}\s*월)?(?:\s*\d{1,2}\s*일)?",
    r"\d{1,2}\s*월\s*\d{1,2}\s*일",
    r"\b(?:19|20)\d{2}\b(?!\s*(?:조|억|원|%|배))",  # 연도
    r"\d\s*분기|\bQ[1-4]\b|\d{4}Q[1-4]",
    r"\d+\s*(?:개|곳|명|건|년|개월|일|위|단계|번째|차)",  # 개수·기간·순위
    r"^\s*\d+[.)]\s",  # 목록 번호
    r"STEP\s*\d+",
    r"[①-⑳]",
]
SENTENCE_SPLIT = re.compile(r"(?<=[.!?。])\s+|\n+")


@dataclass
class Issue:
    kind: str  # uncited_number | unmatched_number | unknown_citation
    sentence: str
    detail: str


@dataclass
class VerificationResult:
    ok: bool
    issues: list[Issue] = field(default_factory=list)
    checked_numbers: int = 0

    def feedback(self) -> str:
        lines = [f"- ({i.kind}) {i.detail} :: \"{i.sentence[:120]}\"" for i in self.issues[:15]]
        return "검증 실패 항목:\n" + "\n".join(lines)


def _decimals(tok: str) -> int:
    return len(tok.split(".")[1]) if "." in tok else 0


def _candidates(value: float) -> list[float]:
    # 원 단위 → 조/억/백만/만, 비율 → %, USD → B/M
    return [value, value * 100, value / 100, value / 1e12, value / 1e8, value / 1e6, value / 1e4, value / 1e9, value / 1e3]


def _matches(num: float, decimals: int, value: float) -> bool:
    tol_round = 0.5 * 10 ** (-decimals) + 1e-9
    for c in _candidates(value):
        if abs(num - c) <= max(tol_round, abs(c) * 0.005):
            return True
    return False


def _numbers_in(sentence: str, quoted: list[str] | None = None) -> list[str]:
    masked = sentence
    for q in quoted or []:  # 문서 제목처럼 인용한 원문 속 숫자는 제외
        masked = masked.replace(q, " " * len(q))
    for pat in IGNORE_PATTERNS:
        masked = re.sub(pat, lambda m: " " * len(m.group(0)), masked)
    return [m.group(0) for m in NUMBER.finditer(masked)]


def verify_text(text: str, ledger: EvidenceLedger) -> VerificationResult:
    issues: list[Issue] = []
    checked = 0
    quoted = sorted({d.label for d in ledger.docs() if d.label}, key=len, reverse=True)
    for raw in SENTENCE_SPLIT.split(text):
        sentence = raw.strip()
        if not sentence or sentence.startswith("|") or sentence.startswith("#"):
            continue  # 표와 제목은 시스템이 증거에서 직접 만든다
        cites = CITE.findall(sentence)
        for c in cites:
            if ledger.get(c) is None:
                issues.append(Issue("unknown_citation", sentence, f"없는 증거 ID {c}"))
        nums = _numbers_in(sentence, quoted)
        if not nums:
            continue
        values = [ledger.get(c).value for c in cites if ledger.get(c) is not None and ledger.get(c).value is not None]
        for tok in nums:
            checked += 1
            num = float(tok.replace(",", ""))
            if not values:
                issues.append(Issue("uncited_number", sentence, f"숫자 {tok} 에 근거 ID가 없습니다"))
                continue
            if not any(_matches(num, _decimals(tok), v) for v in values):
                issues.append(Issue("unmatched_number", sentence, f"숫자 {tok} 가 인용한 근거 {cites} 의 값과 다릅니다"))
    return VerificationResult(ok=not issues, issues=issues, checked_numbers=checked)
