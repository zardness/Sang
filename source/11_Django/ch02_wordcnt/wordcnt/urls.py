# wordcnt 패키지(__init__.py)안의 urls 모듈(*.py)
# wordcnt/         (name=wordcnt:wordinput) 단어 입력받는 화면
# wordcnt/about    (name=wordcnt:about)     도움말
# wordcnt/result   (name=wordcnt:result)    입력받은 단어들의 결과 출력
from django.urls import path
from . import views # .:현재 폴더
app_name = "wordcnt"
urlpatterns=[
  path("", views.wordinput, name="wordinput"),
  path("about/", views.about, name="about"),
  path("result/", views.result, name="result"),

]