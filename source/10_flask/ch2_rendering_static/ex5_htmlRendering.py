from flask import Flask, render_template
from predict import predict_apt_price, r_model
app = Flask(__name__)
@app.route('/')
def hello():
    return render_template('index.html') # templates/index.html
@app.route('/apt/<int:year>/<int:square>')
@app.route('/apt/<int:year>/<int:square>/<int:floor>')
def get_apt_price(year,square,floor=1):
    price = predict_apt_price(year,square,floor)
    return render_template('predict.html',
                           year=year,
                           square=square,
                           floor=floor,
                           price=price) # context변수들

if __name__=='__main__':
    app.run(debug=True,port=8090)