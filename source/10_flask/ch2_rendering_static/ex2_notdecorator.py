def check(func):
    def wrapper():
        print(func.__name__,'함수전처리')
        func()
        print(func.__name__,'함수후처리')
    return wrapper

def hello():
    print(hello.__name__,'함수전처리')
    print('hello')
    print(hello.__name__,'함수후처리')

def world():
    print(world.__name__,'함수전처리')
    print('world')
    print(world.__name__,'함수후처리')

if __name__=='__main__':
    # hello()
    # world()
    trace_hello = check(hello)
    trace_hello()
    trace_world = check(world)  
    trace_world()  