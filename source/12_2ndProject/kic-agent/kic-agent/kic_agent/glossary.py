"""가이드 모드용 용어 DB.

기본 정의는 팀이 쓴 짧은 풀이입니다. 기획서 제출 전에는 data/glossary.csv
(term,definition,source) 로 한국은행 「경제용어 700선」, 금감원 파인 등 출처가 있는 정의로
교체하고 출처를 표기하세요. CSV가 있으면 아래 기본값을 덮어씁니다.
"""
from __future__ import annotations

import csv
import os

DEFAULT_TERMS: dict[str, str] = {
    "시가총액": "주가에 발행주식 수를 곱한 값으로, 시장이 매기는 회사 전체의 가격입니다.",
    "PER": "주가를 주당순이익으로 나눈 값입니다. 이익 1원에 시장이 몇 배를 쳐 주는지를 뜻하며, 같은 업종끼리 비교해야 의미가 있습니다.",
    "PBR": "주가를 주당순자산으로 나눈 값입니다. 1배보다 낮으면 장부상 자산가치보다 싸게 거래된다는 뜻입니다.",
    "ROE": "순이익을 자기자본으로 나눈 비율로, 주주가 맡긴 돈으로 얼마나 이익을 냈는지 보여 줍니다.",
    "영업이익률": "매출에서 영업이익이 차지하는 비율로, 본업에서 얼마나 남기는지 보여 줍니다.",
    "부채비율": "부채총계를 자본총계로 나눈 비율입니다. 높을수록 빚에 기대는 정도가 큽니다.",
    "이자보상배율": "영업이익을 이자비용으로 나눈 값입니다. 1배 미만이면 본업으로 번 돈으로 이자도 못 낸다는 뜻입니다.",
    "자본잠식": "누적 손실로 자본총계가 자본금보다 작아진 상태입니다. 상장 유지 심사에서 중요하게 봅니다.",
    "TTM": "최근 4개 분기를 합친 값(Trailing Twelve Months)으로, 가장 최신의 1년 실적을 보여 줍니다.",
    "EV/EBITDA": "기업가치(시가총액+순부채)를 감가상각 전 영업이익으로 나눈 값으로, 부채 구조가 다른 기업끼리 비교할 때 씁니다.",
    "Peer": "사업 구조와 규모가 비슷해 함께 비교하는 기업 묶음입니다. 누구와 비교하느냐에 따라 결론이 달라집니다.",
    "감사의견": "외부 감사인이 재무제표를 믿을 수 있는지 밝힌 의견입니다. '적정'이 아니면 큰 위험 신호입니다.",
    "유상증자": "회사가 새 주식을 발행해 돈을 모으는 것으로, 기존 주주의 지분이 희석될 수 있습니다.",
    "전환사채": "나중에 주식으로 바꿀 수 있는 회사채(CB)로, 전환되면 주식 수가 늘어납니다.",
}


def load_terms(path: str = "data/glossary.csv") -> dict[str, str]:
    terms = dict(DEFAULT_TERMS)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("term") and row.get("definition"):
                    src = f" (출처: {row['source']})" if row.get("source") else ""
                    terms[row["term"].strip()] = row["definition"].strip() + src
    return terms


def explain_terms(text: str, terms: dict[str, str] | None = None) -> list[tuple[str, str]]:
    terms = terms or load_terms()
    return [(t, d) for t, d in terms.items() if t.lower() in text.lower()]
