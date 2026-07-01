def safe_index(lst,item):
    '''
    첫번째 매개변수 lst에서 item 요소가 있는 index를 변환하는 함수
    item 요소가 없으면 -1을 반환
    '''
    if item in lst:
        return lst.index(item)
    return-1



def safe_remove(lst, remove_item):
    '''
    첫번째 매개변수 lst에서 remove_item 데이터 제거
    해당 remove_item이 lst에 없으면 메세지 출력
    '''
    if remove_item in lst:
        lst.remove(remove_item)
    else:
        print('해당 데이터는 없는 데이터입니다.')

        