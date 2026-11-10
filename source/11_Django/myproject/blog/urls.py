# blog/urls.py 모듈 (blog/~)
from django.urls import path
from . import views
app_name='blog'
urlpatterns = [
    path("", views.list, name="list"), # /blog 요청 (blog:list)
    path("<int:post_id>/", views.detail, name="detail") # blog/1 요청 (blog:detail)
]
