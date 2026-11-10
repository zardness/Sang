from django.contrib import admin
from .models import Post, Comment, Tag
# Register your models here.
admin.site.register(Post) # admin페이지에서 Post테이블 액세스 가능
admin.site.register(Comment)
admin.site.register(Tag)