import joblib

r_model = joblib.load('./model/ex1_apt_price_regression.joblib')

def predict_apt_price(year, square, floor):  
  input_data = [[int(year), int(square), int(floor), 1]]
  result = round(r_model.predict(input_data)[0] * 10000)
  return format(result, ',') + '원'

if __name__=='__main__':
  year = input('몇년?')
  square = input('몇 제곱미터?')
  floor = input('몇층')
  print('예측한 금액은 ', predict_apt_price(year, square, floor))