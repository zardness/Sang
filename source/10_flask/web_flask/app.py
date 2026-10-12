from flask import Flask, request, render_template, redirect, url_for, abort
from repository import (todo_data, get_todos, get_next_id, get_todo, 
                                create_todo, update_todo, delete_todo)
from flask import session # 로그인/로그아웃 여부 체크
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'abc123!') # 세션을 유추하기 위한 secret key

@app.route('/')
def index():
  "로그인 성공 로직 후 /todos(할일 목록 todos함수)로 이동"
  session["user_id"] = "hong" # 세션에 유저 아이디 저장
  session["user_name"] = "홍길동" # 세션에 유저 이름 저장
  # return redirect("/todos") # /todos 요청경로로 이동
  return redirect(url_for("todos")) # todos함수로 이동

@app.route('/logout')
def logout():
  "로그아웃 로직 후 /todos(할일 목록 todos함수)로 이동"
  session.pop("user_id", None) # 세션에 유저 아이디 삭제
  session.pop("user_name", None) # 세션에 유저 이름 삭제
  return redirect(url_for("todos")) # /todos 요청경로로 이동

@app.route('/todos')
def todos():
  "할일 목록 페이지"
  order = request.args.get("order", "asc") # 정렬 순서 받아오기
  todos = get_todos(order) # 정렬 순서 적용한 할일 목록 반환
  next_id = get_next_id()
  return render_template("todo/todos.html", todos=todos, next_id=next_id, order=order)

@app.route('/create', methods=["POST"])
def create():
  "새로운 할일 추가"
  create_todo(request.form.to_dict()) # DB에 todo 추가
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

@app.route('/update/<int:id>', methods=["GET"])
def update(id):
  "해당 id의 할일을 수정할 페이지로"
  todo = get_todo(id) # DB에서 할일 조회
  if todo: # 해당 id의 할일이 존재하면
    return render_template("todo/update.html", todo=todo)
  return abort(404, description=f"{id}번은 존재하지 않는 할일") # 해당 id의 할일이 없으면 404 에러

@app.route('/update/<int:id>', methods=["PUT"])  # 경로에는 수정할 할일의 id만
def update_db(id):
  "해당 id의 할일을 수정하고 성공여부를 반환"
  # fetch가 body에 JSON으로 보낸 데이터를 딕셔너리로 꺼내기
  # silent=True : JSON이 아니면 에러 대신 None → or {} 로 빈 딕셔너리 처리
  data = request.get_json(silent=True) or {}

  content = data.get("content", "")        # 수정할 내용 (한글 그대로 들어옴)
  is_done = data.get("is_done", "False")   # 완료여부 문자열 "True" / "False"

  todo = {
    'id': id,
    'content': content,
    'is_done': is_done == 'True'   # "True"면 True, 그 외는 False (bool로 변환)
  }
  return update_todo(todo)

@app.route('/delete/<int:id>', methods=["DELETE"])
def delete(id):
  "해당 id의 할일을 삭제하고 성공여부를 반환"
  return delete_todo(id)

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5000, debug=False)

# flask --app app run --host=0.0.0.0 --port=80 --debug 실행시 아래 로직이 실행되는 것을 확인할 수 있음