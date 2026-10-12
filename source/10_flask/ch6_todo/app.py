from flask import Flask, request, render_template, redirect, url_for    
from database.repository import get_todos, get_next_id, get_todo, create_todo, update_todo, delete_todo
from models import Todo # 새로운 클래스 추가

from models import Todo
from flask import session

app = Flask(__name__)
app.secret_key = "abc123!"

@app.route('/')
def index():
    "로그인 성공 로직 후/todos로 이동"
    session['user_id'] = "hong"
    session['username'] = "홍길동"
    #return redirect("/todos")
    return redirect(url_for("todos"))

@app.route('/logout')
def logout():
  "로그아웃 로직 후 /todos(할일 목록 todos함수)로 이동"
  session.pop("user_id", None) # 세션에 유저 아이디 저장
  session.pop("user_name", None) # 세션에 유저 이름 저장
  return redirect(url_for("todos")) # /todos 요청경로로 이동

@app.route('/create', methods=["POST"])
def create():
  "새로운 할일 추가"
  todo = Todo(content=request.form.get("content"))
  # print(todo)
  create_todo(todo) # DB에 todo 추가
  return redirect(url_for("todos", order="desc")) # /todos 요청경로로 이동

@app.route('/todos/<int:id>')
def todo(id):
  "해당 id의 할일 상세 페이지"
  todo = get_todo(id) # DB에서 할일 조회
  if todo: # 해당 id의 할일이 존재하면
    return render_template("todo/todo.html", todo=todo)
  return abort(404, description=f"{id}번은 존재하지 않는 할일") # 해당 id의 할일이 없으면 404 에러


@app.errorhandler(404)
def not_found(error):
  return render_template("page_not_found.html", error=error), 404