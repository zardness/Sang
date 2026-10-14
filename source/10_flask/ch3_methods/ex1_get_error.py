# 가상환경 생성 방법1 : python -m venv .venv
# 가상환경 생성 방법2 : ctrl+shift+p => select interpreter입력 => 가상환경만들기 => .venv로 가상환경만들기
# 라이브러리 설치 : pip install flask pydantic(ctrl+j 터미널)
# pip freeze > requirements.txt
'''URL을 통해서 데이터 전달하는 방식
- 쿼리스트링 : CRUD중 C, R
    /apt?year=2002
- 경로파라미터 : CRUD중 U, D => REST API방식
    /apt/2002
'''
from flask import (Flask,         # 앱 객체
                  render_template,# html 랜더링
                  request,        # GET/POST방식으로 파라미터 받기
                  abort)          # 강제로 예외발생
from models import Member

app = Flask(__name__)
#필터링 추가
# @app.template_filter("pw") # 문자 개수 만큼 *로
# def mask_password(pw):
#   return '*'*len(pw)


@app.route('/')
def index():
  return render_template('1_get/index.html') #templates/1_get/index.html

@app.route('/user', methods=['GET']) # /user?name=홍 (쿼리스트링)
def user():
  name = request.args.get('name')
  if name:
    return f'<h1>전달받은 파라미터는 {name}님</h1>'
  else:
    abort(404) # 강제 404 예외 발생

@app.route('/join_form')
def join_form():
  return render_template('1_get/join.html')

@app.route('/join')
def join():
  name = request.args.get('name') # 2글자 이상 GET방식
  id   = request.args.get('id')   # 숫자
  pw   = request.args.get('pw')
  addr = request.args.get('addr')
  try:
    member = Member(name=name, id=id, pw=pw, addr=addr)
  except Exception as e:
    return render_template('error_page.html', error="잘못된 입력"), 500
  return render_template('1_get/result.html', member=member)

@app.errorhandler(404) # 404 예외 페이지 처리
def errorhandler(error):
  return render_template('error_page.html'), 404

if __name__=='__main__':
  app.run(debug=True, port=80)