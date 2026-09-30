from flask import Flask, url_for
app = Flask(__name__)
@app.route('/') # 정적 라우팅
def hello():
    return '<h1>Hello</h1>'
@app.route('/profile/<username>') # 동적라우팅
def get_profile(username):
    return f'<h1>profile:{username}</h1>'

if __name__=='__main__':
    with app.test_request_context():
        print('####',url_for('hello')) # hello와 연결된 url출력
        print('####',url_for('get_profile',username='hong'))
        print('####',url_for('get_profile',username='홍'))
    app.run(debug=True, port=80)