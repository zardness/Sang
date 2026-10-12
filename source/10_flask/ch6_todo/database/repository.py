
from database.connection import conn
from models import Todo
from typing import List # 타입 체크용

def get_todos(order:str="asc") -> List[dict]:
  'get_todos의 매개변수는 문자로 order를 전달받아 return dict list를 반환'
  cursor = conn.cursor()
  if order == "asc":
    sql = "SELECT * FROM TODO ORDER BY ID"
  else:
    sql = "SELECT * FROM TODO ORDER BY ID DESC"
  cursor.execute(sql)
  result = cursor.fetchall()
  keys = [desc[0].lower() for desc in cursor.description]
  todos = [dict(zip(keys, row)) for row in result]
  cursor.close()
  return todos
  

def get_next_id()->int:
  '다음 to_do의 id를 반환'
  cursor = conn.cursor()
  sql = "SELECT NVL(MAX(ID), 0)+1 FROM TODO"  
  cursor.execute(sql)
  result = cursor.fetchone()# 반환값은 (4,) 형태의 tuple
  cursor.close()
  return result[0]


def get_todo(id:int) -> dict:
  '특정 id의 to_do를 반환'
  cursor = conn.cursor()
  sql = "SELECT * FROM TODO WHERE ID = :id"  
  cursor.execute(sql, {"id":id})
  result = cursor.fetchone() # 반환값은 tuple
  keys = [desc[0].lower() for desc in cursor.description]
  todo = dict(zip(keys, result)) if result else None
  cursor.close()
  return todo

def create_todo(todo:Todo) -> int:
  '새로운 to_do를 생성하고 id를 반환'
  cursor = conn.cursor()
  sql = "INSERT INTO TODO (ID, CONTENT) VALUES (TODO_SQ.NEXTVAL, :content)"  
  cursor.execute(sql, {"content":todo.content})
  rows = cursor.rowcount # insert 한 행수
  conn.commit()
  cursor.close()
  return rows # insert 성공시 1 반환


def update_todo(todo:Todo) -> str:
  '해당 todo의 정보를 수정하고 성공여부를 반환'
  cursor = conn.cursor()
  sql = "UPDATE TODO SET CONTENT = :content, IS_DONE = :is_done WHERE ID = :id"
  cursor.execute(sql, todo.model_dump())
  rows = cursor.rowcount # update 한 행수
  conn.commit()
  cursor.close()
  if rows:
    return f"{todo.id}번 {todo.content}를 수정하였습니다."
  else:
    return f"{todo.id}번 todo를 찾을 수 없습니다."

def delete_todo(id:int) -> str:
  '특정 id의 to_do를 삭제하고 성공여부를 반환'
  cursor = conn.cursor()
  sql = "DELETE FROM TODO WHERE ID = :id"
  cursor.execute(sql, {"id":id})
  rows = cursor.rowcount # delete 한 행수
  conn.commit()
  cursor.close()
  if rows:
    return f"{id}번 todo를 삭제하였습니다."
  return f"{id}번 삭제 할 수 없습니다."

if __name__ == '__main__':
  print(create_todo(Todo(id=0, content="프로젝트 마무리")))
  print('전체 목록 :', get_todos())
  print('next id ',get_next_id())
  todo_dict = get_todo(1)
  print(todo_dict)
  todo = Todo(**todo_dict)
  print(todo)
  todo.content = '수정함'
  print(update_todo(todo))
  print(delete_todo(1))
  print('전체 목록 :', get_todos())
  
#실행방법 : python -m database.repository