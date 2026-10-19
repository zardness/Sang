# 실행  : streamlit run 2_summary.py
import streamlit as st
st.set_page_config(page_title="ai요약", page_icon="📝")

st.title("나의 첫 streamlit 앱 어플리케이션") # h1태그
st.header("요약 어플리케이션") # h2태그
st.subheader("요약 어플리케이션을 위한 자동 요약 기능을 제공합니다.")
st.text("이것은 일반텍스트입니다.")
st.write("writre 함수를 사용하여 텍스트를 표시합니다,.")
st.caption("caption 함수를 사용하여 캡션을 표시합니다.")
st.markdown("---")

message = st.text_area("요약할 내용을 입력하세요 : ")
if st.button("요약"):
    st.info('버튼을 클릭했네요\n'+message)
    
if prompt := st.chat_input("쳇 입력하기"):
    st.chat_message("assistant").write(prompt)
    st.chat_message("ai").write(prompt)
    st.chat_message("user").write(prompt)
    st.chat_message("홍길동").write(prompt)