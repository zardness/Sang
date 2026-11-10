from django.db import models
from django.contrib.auth.models import User
# Create your models here.
class Profile(models.Model): #테이블명:accounts_profile(auth_user내용,phone,address)->1:1관계
  user = models.OneToOneField(User, on_delete=models.CASCADE) # user에서 삭제하면 profile도 삭제
  phone_number = models.CharField(verbose_name="전화", max_length=20)
  address = models.CharField(verbose_name="주소", max_length=100)
  def __str__(self):
    return "{} ({}, {})".format(self.user.username, self.phone_number, self.address)