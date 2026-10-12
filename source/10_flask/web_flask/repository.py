from typing import List, Optional  # 타입 체크용(Optional은 **"이 값은 X 타입이거나, 아니면 None일 수 있다"**는 걸 알려주는 타입 힌트)
todo_data = {
  1:{
    'id':1,
    'content':'fast api 공부',
    'is_done':True
  },
2:{
    'id':2,
    'content':'머신러닝 공부',
    'is_done':False
  }
}

def get_todos(order:str="asc") -> List[dict]:
  'get_todos의 매개변수는 문자로 order를 전달받아 return dict list를 반환'
  todos = list(todo_data.values())
  if order == "desc":
    todos.reverse()
  return todos
  

def get_next_id()->int:
  '다음 to_do의 id를 반환'
  return max(todo_data.keys(), default=0) + 1


def get_todo(id:int) -> Optional[dict]:
  '특정 id의 to_do를 반환'
  todo = todo_data.get(id)
    # 복사본을 반환해서, 밖에서 수정해도 원본이 바로 바뀌지 않게 함
  return todo.copy() if todo else None

def create_todo(todo:dict):
  '새로운 to_do를 생성하고 id를 반환'
  print(todo)
  todo['id'] = get_next_id()
  todo_data[todo.get('id')] = todo.copy()

def update_todo(todo:dict) -> str:
  '해당 todo의 정보를 수정하고 성공여부를 반환'
  if todo['id'] in todo_data:
    todo_data[todo.get('id')] = todo.copy()
    return f"{todo.get('id')}번 {todo.get('content')}를 수정하였습니다."
  return f"{todo.get('id')}번 todo를 찾을 수 없습니다."

def delete_todo(id:int) -> str:
  '특정 id의 to_do를 삭제하고 성공여부를 반환'
  if id in todo_data:
    del todo_data[id]
    return f"{id}번 todo를 삭제하였습니다."
  return f"{id}번 삭제 할 수 없습니다."

if __name__ == '__main__':
  print(create_todo({'id':get_next_id(), 'content':"프로젝트 마무리", 'is_done':False}))
  print('전체 목록 :', get_todos())
  print('next id ',get_next_id())
  todo = get_todo(1)
  todo['content'] = '수정함'
  print(update_todo(todo))
  print(delete_todo(1))
  print('전체 목록 :', get_todos())
  
#실행방법 : python -m database.repository