from django.db import models

# 클래스는 테이블 / 객체(인스턴스)는 테이블안의 한row(레코드)
class Student(models.Model): # 테이블이름 : 앱명_클래스명소문자(student_student)
  id = models.AutoField(primary_key=True) # 테이블안의 컬럼
  name = models.CharField(max_length=100, unique=True)
  major = models.CharField(max_length=100, null=True, blank=True)
  age   = models.IntegerField(default=1)
  grade = models.IntegerField(default=1)
  def __str__(self):
    return f"ID:{self.id} - 이름:{self.name} ({self.major}학과 {self.grade}학년 {self.age}살)"
if __name__=='__main__':
  st = Student(name='hong', major='AI', age=20)
  print(st)
