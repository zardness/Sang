from django.shortcuts import render, redirect, reverse,  get_object_or_404
from django.views.generic import CreateView, ListView, UpdateView, DeleteView
from django.urls import reverse_lazy
from .forms import BookForm, BookModelForm
from .models import Book
# 1. form없이 걍 2. form객체생성후(6장) 3. DjangoGenericView 이용(7장) 4. GenericView 상속(7장)
# def book_list(request):
#   return render(request, "book/book_list.html",
#                   {"book_list": Book.objects.all(),
#                   "object_list" : Book.objects.all()})
# 제너릭view 사용
book_list = ListView.as_view(model=Book)
book_new1 = CreateView.as_view(model=Book,
                              fields = ['title', 'author', 'publisher', 'sales']
                              ) # book.ip에는 None
class BookCreateView(CreateView): # 제너릭 뷰 상속
  model = Book
  fields = ['title', 'author', 'publisher', 'sales']
  def form_valid(self, form):
    book = form.save(commit=False)
    book.ip = self.request.META.get('REMOTE_ADDR', 'localhost')
    book.save()
    return redirect(book)

book_new = BookCreateView.as_view() # book.ip까지 저장

book_edit = UpdateView.as_view(model=Book,
                              fields = ['title', 'author', 'publisher', 'sales']
                              ) # book.ip는 수정안 함
book_delete = DeleteView.as_view(model=Book,
                                success_url = "/book/") # delete 성공 후 url
def book_new1(request):
  # GET : template페이지(book/book_form.html ; book을 입력받는 페이지)로 응답
  # POST : 파라미터변수 받아 유효성 체크
    # 1) sucees : db에 insert -> book:list로 
    # 2) fail : 오류메세지와 함께 입력페이지로 이동 ( form 객체 활용 )
  if request.method == 'POST':
    # 파라미터 받아 ip까지 입력한 후 db에 저장
    # title = request.POST.get('title')
    # author = request.POST.get('author')
    # publisher = request.POST.get('publisher')
    # sales = int(request.POST.get('sales'))
    # ip = request.META.get('REMOTE_ADDR', 'localhost') # 요청한 곳의 ip
    # book = Book(title=title, author=author, publisher=publisher, sales=sales, ip=ip)
    # book.save()
    # return redirect(book) # get_absolute_url() 
    form = BookModelForm(request.POST)
    # print(form)
    print('유효성 검증 결과 :', form.is_valid())
    print('유효한 데이터만 : ', form.cleaned_data)
    if form.is_valid():
      book = form.save(commit=False)
      book.ip = request.META.get('REMOTE_ADDR', 'localhost') # 요청한 곳의 ip
      book.save()
      return redirect(book) # get_absolute_url()
  elif request.method == 'GET':
    form = BookModelForm()
    # print(form.as_table())
  return render(request, "book/book_form.html", {"form":form})

def book_edit1(request, pk):
  # GET : 해당 pk id를 수정하는 template(book/book_form.html)
  # POST : 파라미터 받아 유효성 체크
  book = get_object_or_404(Book, id=pk)
  if request.method == 'POST':
    form = BookModelForm(request.POST, instance=book) # instance=book가 없으면 insert
    if form.is_valid():
      # book = form.save() # 수정시 ip는 수정안 됨.
      book = form.save(commit=False)
      book.ip = request.META.get('REMOTE_ADDR', 'localhost') # 요청한 곳의 ip
      book.save()
      return redirect(book)
  elif request.method == 'GET':
    form = BookModelForm(instance=book)
  return render(request, "book/book_form.html", {"form":form})

def book_delete1(request, pk):
  book = get_object_or_404(Book, pk=pk)
  # book.delete()
  # return redirect(book) # book.get_absolute_url() 호출
  # GET : 삭제할지 한번 더 물어보는 template으로(book/book_confirm_delete.html)
  # POST : db의 book을 delete
  if request.method == 'POST':
    book.delete()
    return redirect(book)
  elif request.method == 'GET':
    return render(request, "book/book_confirm_delete.html", {"object":book})