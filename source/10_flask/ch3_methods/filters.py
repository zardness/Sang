def mask_password(pw):
    return '*'*len(pw)

def mask_comma(value):
    return f'{value:,}'
if __name__=='__main__':
  pw = 'abc'
  print('비번 :', pw)
  print('비번 :', mask_password(pw))
  value = 1000000
  print('value :', value)
  print('value :', mask_comma(value))