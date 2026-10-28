"""Streamlit 데모 화면: 대화 입력 + 보고서 미리보기 + 근거 패널.

실행: streamlit run app.py
"""
from __future__ import annotations

import tempfile

import pandas as pd
import streamlit as st

from kic_agent import CompanyNotFound, Mode, ResearchAgent
from kic_agent.db import PostgresDB

st.set_page_config(page_title="KIC 리서치 Agent", layout="wide")


@st.cache_resource
def get_agent() -> ResearchAgent:
    return ResearchAgent(PostgresDB())


with st.sidebar:
    st.header("KIC 리서치 Agent")
    mode_label = st.radio("모드", ["전문가 모드", "가이드 모드 (입문자)"])
    mode = Mode.GUIDE if mode_label.startswith("가이드") else Mode.EXPERT
    task = st.selectbox("작업", ["② Peer 비교 보고서", "③ 리스크 심사", "① 신규 공시 모니터링", "자유 질문"])
    st.caption("숫자는 DB 조회 결과만 인용하며, 모든 수치에 근거 ID가 붙습니다. 매수·매도 추천이 아닙니다.")

agent = get_agent()
if agent.llm is None:
    st.info("LLM 키가 없어 템플릿 작성기로 동작합니다. 자유 질문은 ANTHROPIC_API_KEY 가 필요합니다.")

if task == "① 신규 공시 모니터링":
    hours = st.slider("최근 몇 시간", 1, 72, 24)
    if st.button("실행"):
        res = agent.monitor(hours, mode)
        st.subheader("브리핑")
        st.write(res["briefing"])
        if res["disclosures"]:
            st.dataframe(pd.DataFrame(res["disclosures"]), use_container_width=True)
        for rep in res["reviews"]:
            with st.expander(rep.title):
                st.markdown(rep.to_markdown())
    st.stop()

placeholder = "예: 삼성전자 또는 005930" if task != "자유 질문" else "예: SK하이닉스의 최근 4개 분기 영업이익률 추이는?"
query = st.chat_input(placeholder)
if query:
    with st.spinner("도구 실행 → 작성 → 검증 중"):
        try:
            if task.startswith("②"):
                rep = agent.peer_report(query, mode)
            elif task.startswith("③"):
                rep = agent.risk_review(query, mode)
            else:
                rep = agent.ask(query, mode)
        except (CompanyNotFound, RuntimeError) as e:
            st.error(str(e))
            st.stop()

    left, right = st.columns([3, 2])
    with left:
        st.subheader(rep.title)
        (st.success if rep.verified else st.warning)(
            f"검증 {'통과' if rep.verified else '실패'} · 확인한 숫자 {rep.verification.checked_numbers if rep.verification else 0}개 · 작성 시도 {rep.attempts}회"
        )
        st.markdown(rep.narrative)
        for name, rows in rep.tables.items():
            if rows:
                st.markdown(f"**{name}**")
                st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        if rep.appendix:
            st.markdown(rep.appendix)
    with right:
        st.subheader("근거 패널")
        st.dataframe(pd.DataFrame(rep.ledger.to_rows()), use_container_width=True, hide_index=True)
        if rep.verification and not rep.verification.ok:
            st.code(rep.verification.feedback())
        with tempfile.NamedTemporaryFile(suffix=".xlsx") as tmp:
            rep.to_excel(tmp.name)
            data = open(tmp.name, "rb").read()
        st.download_button("Excel 내려받기", data, file_name=f"{rep.title}.xlsx")
        st.download_button("Markdown 내려받기", rep.to_markdown().encode("utf-8"), file_name=f"{rep.title}.md")
