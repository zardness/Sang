import streamlit as st
# from 1_summary import askGPT 불가
from dotenv import load_dotenv
from openai import OpenAI
import os
def askGPT(message):
    'GPT모델에게 요청하여 message를 요약한 결과를 반환합니다.'
    client = OpenAI()
    response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[
    {
        'role':'system', 
        'content':'당신은 한국어로 된 텍스트를 잘 요약하는 전문 어시스턴트입니다'
    },
    {
        'role':'user',
        'content':f'''다음의 text를 한줄로 요약하세요. 글머리표를 사용하세요.
        text : {message}'''
    }
    ]
    )
    return response.choices[0].message.content

def main():
    load_dotenv()
    st.set_page_config(page_title="ai요약", page_icon="🤖")
    # st.text(os.getenv('OPENAI_API_KEY'))
    st.header("요약 어시스턴트")
    st.subheader("한국어 텍스트 요약을 지원합니다.")
    message = st.text_area("요약할 내용을 입력하세요")
    if st.button("요약"):
        st.info(askGPT(message))

if __name__ == '__main__':
    main()