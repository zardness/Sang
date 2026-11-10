from django.shortcuts import render
from django.http import HttpResponse
# Create your views here. (home/views.py)
def home(request):
  # return HttpResponse("<h1>Hello, Django</h1>")
  return render(request,
                "home.html",     # 폴더/templates/home.html
                context={"msg" : "Django(장고)"})