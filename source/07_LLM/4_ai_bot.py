# 인터프리터선택(ctrl+shift+p) ->  실행 ctrl+j : streamlit run 7_aibot.py
# docs.streamlit.io
import streamlit as st
from ai_llm import ask_with_reference
st.set_page_config(page_title="소득세 쳇봇", page_icon="💰")

st.title("💰소득세 쳇봇")
st.caption("소득세 쳇봇을 사용하여 질문에 답변하고 참조 조항을 함께 반환합니다.")
# 저장될 대화 이력를 초기화
if 'messages' not in st.session_state:
    st.session_state.messages = []
# 대화 이력 표시
for msg in st.session_state.messages:
    st.chat_message(msg["role"]).write(msg["content"])

if user_question := st.chat_input(placeholder="소득세에 관련 질문을 물어보세요"):
    st.chat_message("user").write(user_question)
    # 사용자 질문을 session 추가하고 출력
    st.session_state.messages.append({"role":"user", "content":user_question})
    # AI 응답을 받아 session 추가하고 출력
    with st.spinner("질문에 답변을 생성하는 중입니다"):
        answer = ask_with_reference(user_question ) 
        st.chat_message("ai").write(answer)
        st.session_state.messages.append({"role":"ai", "content":answer})