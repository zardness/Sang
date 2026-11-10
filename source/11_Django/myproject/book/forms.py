# book/forms.py
from django import forms
from django.core.validators import MinLengthValidator
from django.core.validators import MinValueValidator
from django.core.validators import MaxValueValidator
from .models import Book
# Create your models here.
def min_length_2_validator(value):
  if len(value)<2:
    raise forms.ValidationError('2글자 이상 입력하세요')
  
# Create your models here.
class BookForm(forms.Form):
  title  = forms.CharField(label="책제목")
  author = forms.CharField(label="책쓴이",
                    validators=[min_length_2_validator
                                #MinLengthValidator(2) 
                                ])
  publisher = forms.CharField(label="출판사", required=False)
  sales     = forms.IntegerField(label="판매가",
                                  initial=1000,
                                  validators=[MinValueValidator(0),
                                              MaxValueValidator(1000000)])
  def save(self, commit=True):
    book = Book(**self.cleaned_data) # cleaned_data : 유효성검사가 완료된 데이터
    if commit:
      book.save()
    return book

class BookModelForm(forms.ModelForm):
  class Meta:
    model = Book
    # fields = '__all__'
    fields = ['title', 'author', 'publisher', 'sales']