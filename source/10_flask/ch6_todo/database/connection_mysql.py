import pymysql
import os
from dotenv import load_dotenv
load_dotenv()
dbserver_ip = os.getenv('DBSERVER_IP')
mysql_port = int(os.getenv('MYSQL_PORT'))
mysql_user = os.getenv('MYSQL_USER')
mysql_password = os.getenv('MYSQL_PASSWORD')
mysql_db=os.getenv('MYSQL_DB')
conn = pymysql.connect(
    host=dbserver_ip,  
    port=mysql_port,
    user=mysql_user,     
    password=mysql_password,
    database=mysql_db,
    charset='utf8mb4'
)
if __name__ == "__main__":
    print(conn)