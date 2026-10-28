"""전문가 모드 / 가이드 모드: 같은 결과, 다른 깊이와 설명 방식."""
from __future__ import annotations

from enum import Enum

from .glossary import explain_terms


class Mode(str, Enum):
    EXPERT = "expert"
    GUIDE = "guide"


COMMON_RULES = """규칙:
- 숫자는 아래 [근거] 목록에 있는 값만 쓴다. 표기도 목록 그대로 옮긴다. 새 숫자를 계산하거나 추정하지 않는다.
- 숫자를 쓴 문장 끝에는 반드시 해당 근거 ID를 [E3] 처럼 붙인다. 문서를 인용할 때는 [D1] 을 붙인다.
- 매수·매도 추천, 목표주가, 수익 보장 표현을 쓰지 않는다. "검토 참고치", "리스크 요약"으로 쓴다.
- 근거가 없는 내용은 "데이터 없음"이라고 쓴다.
- 비교표는 시스템이 따로 붙이므로 본문에 표를 그리지 않는다."""

EXPERT_STYLE = """당신은 증권사 리서치 애널리스트를 보조하는 Agent다.
간결하게 쓴다. 핵심 결론 → 근거 수치 → 리스크 순서로, 5~8문장 이내."""

GUIDE_STYLE = """당신은 기업 분석을 처음 배우는 사람을 돕는 가이드 Agent다.
종목을 추천하지 않고 "기업을 분석하는 방법"을 안내한다.
- 같은 결과를 쓰되, 지표가 나올 때마다 그 지표가 무엇을 뜻하는지 한 문장으로 풀어 준다.
- "왜 이 기업들과 비교하는가"를 Peer 선정 이유로 설명한다.
- 마지막에 "다음에 확인해 볼 것" 2~3가지를 질문 형태로 제시한다.
- 쉬운 말로, 문장은 짧게."""


def system_prompt(mode: Mode) -> str:
    style = GUIDE_STYLE if mode == Mode.GUIDE else EXPERT_STYLE
    return f"{style}\n\n{COMMON_RULES}"


def guide_appendix(mode: Mode, text_and_labels: str, peer_reasons: list[tuple[str, str]] | None = None) -> str:
    """가이드 모드에서 보고서 뒤에 붙이는 '용어 풀이'와 'Peer 선정 이유'. 숫자 없음."""
    if mode != Mode.GUIDE:
        return ""
    parts = []
    terms = explain_terms(text_and_labels)
    if terms:
        parts.append("### 지표 풀이\n" + "\n".join(f"- **{t}**: {d}" for t, d in terms))
    if peer_reasons:
        parts.append("### 왜 이 기업들과 비교하나요\n" + "\n".join(f"- **{n}**: {r}" for n, r in peer_reasons if r))
    parts.append(
        "### 다음에 확인해 볼 것\n"
        "- 비교 기업과 차이가 가장 큰 지표는 무엇이고, 그 이유는 사업 구조 차이일까요?\n"
        "- 최근 공시 중 숫자에 영향을 줄 만한 이벤트(증자, 수주, 소송)가 있었나요?\n"
        "- 같은 지표를 3년 전과 비교하면 좋아졌나요, 나빠졌나요?"
    )
    return "\n\n".join(parts)
