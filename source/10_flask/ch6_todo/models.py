# pip install pydantic
from pydantic import BaseModel
class Todo(BaseModel):
    id: int | None = None
    content: str
    is_done: bool | None = False

if __name__ == "__main__":
    todo = Todo(content="테스트")
    print(todo)
    print(todo.model_dump())