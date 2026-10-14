# class Member:
#   def __init__(self, name, id, pw, addr):
#     name이 2글자 이상
#     self.name = name
from pydantic import BaseModel, Field
class Member(BaseModel):
  name:str = Field(min_length=2, max_length=10, description="이름")
  # gt=0:id>0, ge=0:id>=0, lt=0:id<0, le=0:id<=0
  id:int   = Field(gt=0, description="아이디")
  pw:str
  addr:str = Field(default="서울", description="주소")
if __name__=='__main__':
  member = Member(name='홍길', id='123', pw='aa')
  print(member)