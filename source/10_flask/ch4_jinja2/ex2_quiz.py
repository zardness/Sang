from flask import Flask,render_template, request

app = Flask(__name__)

@app.route('/', methods=['get','post'])
def index(no=None):
    if request.method == 'POST':
        no = request.form.get('no') # 파라미터는 
    return render_template('2_quiz.html',no=no)

@app.errorhandler(404)
def not_found(error):
    return render_template("page_not_found.html",error=error)