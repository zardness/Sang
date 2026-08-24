-- DCL(계정생성, 권한부여, 권한박탈, 계정삭제)
-- DDL(타입, 시퀀스 없음)
-- DML(outer join, and;&&, or;||, 일부함수)

-- ■■■■■■■■■■■■■■■■
-- ■■■ ※ DCL ※ ■■■
-- ■■■■■■■■■■■■■■■■
create user userid identified by 'password'; -- 계정생성
grant all privileges on *.* to userid; -- 권한 부여
-- 데이터 배이스로 들어가기 
show databases; -- 데이터 배이스들의 리스트
revoke all on *.* from userid; -- 권한박탈
drop user userid; -- 계정 삭제
create database devdb; -- 새로운 데이터 배이스(devdb)생성
show databases;
use devdb; -- 데이터배이스로 들어감
use information_schema;
show tables; -- 현재 데이터 배이스 내의 태이블들
use devdb;
show tables; -- 현재 데이터 배이스 내의 태이블들

-- ■■■■■■■■■■■■■■■■
-- ■■■ ※ DDL ※ ■■■
-- ■■■■■■■■■■■■■■■■
/*
mySQL 타입 : numeric(n,d), varchra(n), date
정수 : tinyint(1byte), smallint(2byte), dediumint(3byte)
      int/intger(4byte), bigint(8byte)
실수 : float(n,d ; 4byte), double(n,d;8byte)
문자 : char(n;비추),text, longtext(4GB)
*/
drop table if exists friend;
create table friend(
	no int 			 primary key auto_increment, -- auto_increment 필드 타입은 int
	name varchar(30) not null,
    tel varchar(30) unique,
    age numeric(3) default 1 check(age>=0),
    last_modify datetime default now()
);
select * from friend;
insert into friend (name, tel) values ('홍길동',null);
insert into friend (name, tel, age) values ('성춘향','010-9999-9999',22);

-- ★ ★ ★ 파이썬 수업시간에 쓸 태이블 ★ ★ ★ 
-- DDL과 DML은 데이터 배이스 안에서만 실행
select database();
drop table if exists person; -- emp태이블 
drop table if exists division; -- -dept 태이블 유사
create table division(
	dno int primary key,
    dname varchar(20),
    phone varchar(20),
    position varchar(20)
);
create table person(
	pno int primary key,
    pname varchar(15) not null,
    job   varchar(15) not null,
    manager int, -- 상사사번
    hiredate date, -- 입사일
    sal 	numeric(10),
    comm 	numeric(10),
    dno 	int, 
    foreign key(dno) references division(dno)
);
insert into division values (10, 'finance', '02-2088-5679','신림');
insert into division values (20, 'research', '02-555-4321','강남');
insert into division values (30, 'sales', '02-717-4321','마포');
insert into division values (40, 'cs', '031-4444-4321','수원');

insert into person values (1111,'smith','manager', 1001, '1990-12-17', 1000, null, 10);
insert into person values (1112,'ally','salesman',1116,'1991-02-20',1600,500,30);
insert into person values (1113,'word','salesman',1116,'1992-02-24',1450,300,30);
insert into person values (1114,'james','manager',1001,'1990-04-12',3975,null,20);
insert into person values (1001,'bill','president',null,'1989-01-10',7000,null,10);
insert into person values (1116,'johnson','manager',1001,'1991-05-01',3550,null,30);
insert into person values (1118,'martin','analyst',1111,'1991-09-09',3450,null,10);
insert into person values (1121,'kim','clerk',1114,'1990-12-08',4000,null,20);
insert into person values (1123,'lee','salesman',1116,'1991-09-23',1200,0,30);
insert into person values (1226,'park','analyst',1111,'1990-01-03',2500,null,10);
select*from division;
select*from person;

-- 1. 사번, 이름, 급여를 출력
-- select 보고싶은 필드명 from person where 조건 order by 정렬할 기준...
select manager, pname,sal from person; 
-- 2. 급여가 2000~5000 사이 모든 직원의 모든 필드
select * from person where sal between 2000 and 5000; 
-- 3. 부서번호가 10또는 20인 사원의 사번, 이름, 부서번호
select dno,pname,job from person where dno in (10,20);
-- 4. 보너스가 null인 사원의 사번, 이름, 급여, 보너스. 급여 큰 순정렬
select pno,pname,sal,comm from person where comm is null order by sal desc;
-- 5. 사번, 이름, 부서번호, 급여. 부서코드 순 정렬 같으면 PAY 큰순
select pno,pname,sal,dno from person order by dno,sal desc;
-- 6. 사번, 이름, 부서명
select pno, pname, dname from person p, division d where p.dno=d.dno;
-- select pno,pname,dname
-- 7. 사번, 이름, 상사이름
select w.pno, w.pname, m.pname
	from person w, person m
    where w.manager=m.pno;
    
-- select w.pno, w.pname, m.pname
-- 	from person w, join person m
--     on w.manager=m.pno;
    
-- 8. 사번, 이름, 상사이름(상사가 없는 사람도 출력하되 상사가 없는 경우 ★CEO★로 출력) – oracle과 다른 문법
select w.pno,w.pname,ifnull(m.pname,'★CEO★') manager
 	from person w left join person m on w.manager = m.pno;
      
    
-- 8-1 사번, 이름, 상사사번(상사가 없으면 ceo로 출력. ifnull함수의 매개변수의 타입이 상이해도 상관없음) – oracle과 다른 문법
select pno,pname,ifnull(manager,'ceo')manager from person;
-- 9. 이름이 s로 시작하는 사원 이름 (like 이용)
select pname from person where pname like 's%';
-- 10. 사번, 이름, 급여, 부서명, 상사이름 – orcale과 다른 문법
select p.pno,p.pname,p.sal,dname, k.pname
	from division d, person p, person k
    where d.dno=p.dno and p.manager = k.pno;

-- oracle과 


date pname, date_format(hireddate,'%Y년%m월%d일 %p %h:%1:%s')from person;

-- format(숫자필드, 소숫점자리수)
select pname, format(sal,0) sal from person;

-- 오라클에서 연결연산자 || 'smith는 manager다'
select pname || '는' || job || '다' from person; -- mySQL에서의 ||는 or연산자
select concat(pname,'는',job,'다') from person;