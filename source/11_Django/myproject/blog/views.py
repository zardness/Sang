from django.shortcuts import render, redirect, get_object_or_404
from .models import Post
from django.contrib import messages
# Create your views here.
def list(request):
  post_list = Post.objects.all()
  return render(request, 
                "blog/index.html",
                {"post_list":post_list,
                # "user":request.user #: context_processors.request역할
                })

def detail(request, post_id:int):
  print("request.user :", request.user)
  # 1. try-except구문 2.filter함수
  qs = Post.objects.filter(id=post_id)
  if qs:
    post = qs[0]
    return render(request, "blog/detail.html", {"post":post})
  else: # 해당 post_id가 존재하지 않는 경우
    messages.error(request, f"{post_id}번 post가 존재하지 않습니다")
    return redirect("blog:list")