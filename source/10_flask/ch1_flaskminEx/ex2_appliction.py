from flask import Flask
from predict import r_model, predict_apt_price
application = Flask(__name__) # 웹어플리케이션 객체 생성

@application.route('/hello')
def handler_function():
  return "<h1>Hello, Flask!</h1>"
# /apt/2002/102/8
@application.route('/apt/<year>/<square>/<floor>')
def aptPredictHandler(year, square, floor):
  answer = predict_apt_price(year, square, floor)
  return f"<h1>예측한 금액은 {answer}입니다</h1>"

if __name__=='__main__':
  # debug=True : 코드가 변경될 때마다 자동 서버 재시작
  application.run(debug=True)