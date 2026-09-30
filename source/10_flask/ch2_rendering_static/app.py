# 가상환경 만들기 :python -m venv .venv
# 가상환경 들어가기 : .venv\Script\activate
# 필요한 라이브러리 : statsmodels, joblib,flask(개별설치X)
# 필요한 라이브러리 설치 : pip install -r requirements.txt
# 파일명 app.py 이면 실행 : flask run --debug
from flask import Flask
app=Flask(__name__) # 앱 인스턴스 생성(웹서버 기록)
@app.route('/') # @데코레이터를 통해서 가능한 url 등록
def main_handler():
    return'<h1>Hello world</h1>'

@app.route('/apt')
def get_apt():
    # return'<h1>예상가격은 100원입니다.</h1>'
    return{
        
    }