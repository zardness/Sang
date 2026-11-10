from django.db import models
import re
from django.forms import ValidationError
from django.utils import timezone
# Create your models here.

REGION_CHOICE = (
  ("Europe","유럽"),
  ("Asia", "아시아"),
  ("Oceania","오세아니아"),
  ("America","아메리카"),
)
def lnglat_validator(value):
  if not re.match(r'(\d+\.?\d*),(\d+\.?\d*)', value):
    raise ValidationError('Invalid LngLat. ex:128,38')

class Tag(models.Model): # 테이블명 : blog_tag / post:tag = 다:다(M:N)관계
  # id    = models.AutoField(primary_key=True) PK가 없을 경우 자동 생성
  name = models.CharField(max_length=50, unique=True)
  def __str__(self):
    return "#" + self.name

class Post(models.Model): # 1. 테이블명 : blog_post(앱명_클래스명소문자) 2.form태그
  # id    = models.AutoField(primary_key=True) PK가 없을 경우 자동 생성
  title = models.CharField(verbose_name="제목", # form태그의 라벨
                          max_length=100,       # varchar(100) 필드로 생성
                          help_text="기사 제목입니다. 100자 내외로 입력하세요")
  content = models.TextField("본문") # CLOB타입(oracle), TEXT타입(sqlite, mysql)
  region = models.CharField(verbose_name="지역",
                            max_length=100,
                            choices=REGION_CHOICE,
                            default="Asia")
  lnglat = models.CharField(verbose_name="경,위도",
                          max_length=100,
                          blank=True,
                          null=True,
                          help_text="경도,위도 포맷 ex128.21,37",
                          validators=[lnglat_validator])
  url    = models.URLField(blank=True, null=True)
  tags   = models.ManyToManyField(Tag) # 다대다관계
  create_at = models.DateField(auto_now_add=True) # insert할 때 자동 저장
  update_at = models.DateTimeField(auto_now=True) # save()함수 수행될 때 자동 저장

  def __str__(self): # 한 레크도에 대해 작업 처리
    updated = timezone.localtime(self.update_at).strftime("%Y-%m-%d %H:%M")
    return f"{self.id}.제목:{self.title} - {self.create_at}등록. {updated}최종수정"
  class Meta: # Post의 내부 클래스
    ordering = ['-update_at'] # update_at기준으로 내림차순 정렬로 가져오기
    unique_together = [('title', 'content')] # 같은 title과 content는 insert및 update 불가

class Comment(models.Model): # 테이블명 blog_comment Post:Comment = 1:N 관계(1:다 관계)
  # id = models.AutoField(primary_key=True)
  post = models.ForeignKey(Post, # post테이블과 1:다 관계 (필드명:post_id)
                        on_delete=models.CASCADE) # post의 한행을 delete할 경우 댓글도 자동 삭제
  author = models.CharField(verbose_name="댓글쓴이", max_length=20, null=True, blank=True)
  message = models.TextField(verbose_name="댓글")
  create_at = models.DateField(auto_now_add=True) # insert한 날짜
  update_at = models.DateTimeField(auto_now=True) # save() 실행 시점
  def __str__(self):
    return "{}번글의 댓글 {} (by {}, at {})".format(self.post.pk,
                                              self.message,
                                              self.author,
                                              self.create_at)
  class Meta:
    ordering = ['-update_at']