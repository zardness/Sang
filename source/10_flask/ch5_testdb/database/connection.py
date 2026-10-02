import cx_Oracle
conn = cx_Oracle.connect("scott",
                         "tiger",
                         "localhost:1521/xe")