# 데코레이터 : 플라스크를 포함해 다른 오픈소스 코드에 @로 시작하는 구문
# 대상함수를 감싸 함수 앞뒤에 부가적으로 반복작업을 

def check(func):
    def wrapper():
        print(func.__name__,'함수전처리')
        func()
        print(func.__name__,'함수후처리')
    return wrapper
@check
def hello():
    #print(hello.__name__,'함수전처리')
    print('hello')
    #print(hello.__name__,'함수후처리')
@check
def world():
    #print(world.__name__,'함수전처리')
    print('world')
    #print(world.__name__,'함수후처리')

if __name__=='__main__':
    hello()
    world()
    # trace_hello = check(hello)
    # trace_hello()
    # trace_world = check(world)  
    # trace_world()  