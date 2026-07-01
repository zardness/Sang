# cho5.py
def my_hello(cnt:int):#python을 cnt번 출력 +__name__까지 출력
        for i in range(cnt):
            print('Hello,python', end='\t')
            print('Hi,Python')
        print(__name__)  
if __name__=="__main__":
      my_hello(3) 
