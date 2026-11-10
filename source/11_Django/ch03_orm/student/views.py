from django.shortcuts import render, redirect, get_object_or_404
from .models import Student
from django.contrib import messages
from django.http import HttpResponse

# Create your views here.
def list(request):
  students = Student.objects.all()
  return render(request, "student/list.html", {"students":students})

def get(request, id:int):
  # student = Student.objects.get(id=id)
  # student = get_object_or_404(Student, id=id) # 해당 id가 없어서 예외가 날 경우 404.html로(Debug=False)
  # return render(request, "student/get.html", {"student":student})
  try:
    student = Student.objects.get(id=id)
    return render(request, "student/get.html", {"student":student})
  except:
    messages.error(request, f"{id}번 학생을 찾을 수 없습니다")
    return redirect("/student")

def delete(request, id:int):
  student = Student.objects.filter(id=id) # 해당 id데이터들을 list
  if student:
    student.delete()
    messages.success(request, f"{id}번 학생 삭제 완료")
    return redirect("student:list")  # redirect("/student")
  else:
    messages.error(request, f"{id}번 학생을 찾을 수 없어 삭제 불가")
    return redirect("student:list")