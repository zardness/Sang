from dotenv import load_dotenv
from openai import OpenAI
def askGPT(message):
    'GPT모델에게 요청하여 message를 요약한 결과를 반환합니다.'
    load_dotenv()
    client = OpenAI()
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "assistant", 
            "content": "당신은 한국어로 된 텍스틀르 잘요약하는 전문 어시스턴트 입니다."
            },
            {
                'role': 'user',
                'content': f'''다음의 text를 한줄로 요약하세요. 글머리 표를 사용하세요.
                text : {message}'''
            }
        ],
    )
    return response.choices[0].message.content

if __name__ == '__main__':
    message = input('요약할 내용을 입력하세요 : ')
    summary = askGPT(message)
    print("요약은 다음과 같습니다.\n")
    print(summary)
