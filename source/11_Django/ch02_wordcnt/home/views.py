from django.shortcuts import render
from django.http import HttpResponse
# Create your views here.
def index(request):
  context = {
              "msg":"Word Count Welcome Page",
              "greeting":"Hello, Django(장고)"
            }
  return render(request=request,
                template_name="home/index.html", #templates/home/index.html
                context=context)

def test(request):
  return HttpResponse("""
            <h1>테스트 페이지</h1>
            <button onclick="location.href='/'">뒤로가기</button>
          """)

def showIntId(request, id:int):
  msg = f"숫자 ID : {id}"
  id_type = "int입니다"
  return render(request,
                "home/showId.html",
                {"msg":msg, "type":id_type})

def showStrId(request, id:str):
  msg = f"문자 ID : {id}"
  id_type = "문자입니다"
  return render(request,
                "home/showId.html",
                {"msg":msg, "type":id_type})