from django.test import TestCase

# Create your tests here.
import re
lnglat = "125a,37" # "126.23,37.54235"
result = re.match(r"(\d{1,3}\.?\d*),(\d{1,3}\.?\d*)", lnglat)
if not result:
  print('정규표현식과 일치하지 않음')
else:
  print(result.group(0), result.group(1), result.group(2))