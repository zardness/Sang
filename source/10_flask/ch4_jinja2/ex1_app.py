### Jinja2 templates 문법
  # 1. 변수 : {{var}} 또는 {{var|filter}} 사용
    # 기본제공필터 : upper,lower,title,capitqalize, trim, length, replace
    # 형변환 제공필터 : int, float, string
  # 2. 제어문 {% %}
    # 2-1 조건문 {% if 조건1 %}태그{% elif 조건2 %}태그 {% else %}태그{% endif %}
    # 2-2 반복문
      # {% for var in 나열가능변수 %}
      #  <태그>{{loop.index}}.{{var}}</태그>
      # loop.index:1번부터 순번 / loop.first:첫번쨰 인지 여부 /loop.last:마지막인지여부
      # {% endfor %}
  # 3.해더나 풋터 {% include "header.html"%} {% extends "base.html" %}  
  # 4.서브블락 {% block 블럭명 %}{%endblock%}
  # 5.주석

from flask import Flask, render_template, request
app = Flask(__name__, static_folder='static',template_folder='templates')
lst = []

@app.route('/',methods=['GET','POST'])
def index(name=""):
    if request.method == 'POST':
        name = request.form.get('name').strip()
        lst.append(name)
    cnt = len(lst)
    return render_template('1_index.html',
                           name=name,
                           cnt=cnt,
                           names = lst)

if __name__=="__main__":
    app.run(debug=True,port=80)