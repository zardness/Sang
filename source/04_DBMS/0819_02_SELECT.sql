--[II] SELECT문 - 조회
--1. SELECT문자 작성방법(실행:CTRL+ENTER)
SELECT * FROM TAB; --현계정이 가지고있는 태이블 정보
SELECT * FROM EMP; --EMP태이블의 모든정보(모든 열,모든행)
SELECT * FROM dept; --DEPT태이블의 모든정보
SELECT * FROM SALGRADE;

--2. 특정 열만 출력
DESC EMP;
    --EMP태이블 구조
SELECT EMPNO, ENAME,SAL, HIREDATE FROM EMP; --EMP태이블에서 SELECT EMPNO, ENAME,SAL열만 검색
SELECT EMPNO AS "사 번", ENAME  AS "이름",SAL AS"급여", HIREDATE AS "입사일" FROM EMP;
SELECT EMPNO "사 번", ENAME "이름",SAL "급여", HIREDATE  "입사일" FROM EMP;
SELECT EMPNO "사 번", ENAME 이름,SAL 급여, HIREDATE 입사일 FROM EMP;

--3. 특정 행만 출력 : WHERE절(조건절)에서 비교연산자 - 같다(=), 다르다(!=,^=,<>),>,<,>=,<=
SELECT EMPNO NO, ENAME NAME, SAL 
    FROM EMP 
    WHERE SAL=3000;
SELECT EMPNO NO, ENAME NAME, SAL 
    FROM EMP 
    WHERE SAL<>3000;
SELECT EMPNO NO, ENAME NAME, SAL 
    FROM EMP 
    WHERE SAL>3000;
    --비교연산자는 숫자,문자,날짜 모두 가능
    --EX1. 사원이름(ENAME)이 'A','B','C'로 시작하는 사원의 모든 필드 'A'<'AA'<'AAA'<B'<'C'<'CA'<'CAA'..
    SELECT * FROM EMP WHERE ENAME<'D';
    --EX2. 81년도 이전에 입사(HIREDATE)한 사원의 모든 필드
    SELECT * FROM EMP WHERE HIREDATE<'81/01/01';
    
    --날짜 표기법 셋팅(현재:RR/MM/DD)
    ALTER SESSION SET NLS_DATE_FORMAT = 'MM-DD-YYYY';
    SELECT * FROM EMP 
        WHERE TO_CHAR(HIREDATE,'RR/MM/DD')<81/01/01;
    SELECT * FROM EMP
        WHERE HIREDATE<TO_DATE('81\01\01','RR/MM/DD');
    ALTER SESSION SET NLS_DATE_FORMAT = 'RR/MM/DD';

--4. 특정 행만 출력 : WHERE절(조건절)에서 놀니연산자 : OR, AND,NOT
    --EX1. 급여(SAL)가 2000부터 3000인 잭원의 모든필드
    SELECT * FROM EMP WHERE 2000<=SAL AND SAL<=3000;
    --EX2. 82년도에 입사한 사원의 모든 필드
    SELECT * FROM EMP WHERE HIREDATE>='82/01/01' AND HIREDATE<='82/12/31';
    SELECT * FROM EMP 
        WHERE HIREDATE>=TO_DATE('82/01/01/','RR/MM/DD') AND HIREDATE<=TO_DATE('82/12/31','RR/MM/DD');
    --EX3. 10번 부서(DEPTNO)이거나 JOB이 MANAGER인 직원의 모든 필드;
    SELECT * FROM EMP WHERE DEPTNO=10 OR JOB='MANAGER';
--5.산술연산자(SELECT절,WHERE절,ORDER BY절)
    -- EX. 연봉이 2400이상인 직원의 ENAME, SAL, 연봉(SAL*12)
    SELECT ENAME, SAL, SAL*12 연봉 -- (3)
        FROM EMP                   -- (1)번째
        WHERE SAL*12>=2400           -- (2)번째
        ORDER BY 연봉; -- 연봉 순 오름차순(ASC) 정렬 (4)번째
    -- EX. 연봉이 10000이상인 직원의 ENAME, SAL, 연봉(SAL*12+COMM)
    SELECT ENAME, SAL, SAL*12+COMM "연봉"
        FROM EMP;


--6. 연결연산자(||) : 필드나 문자를 연결
SELECT ENAME || '은' || JOB FROM EMP;
    --EX. 모든사원에 대해서 "SMITH의 연봉은 XXXX$입니다."라고 출력하고 TITLE에는 MESSAGE.
    SELECT ENAME || '의 연봉은' || (SAL*12+NVL(COMM,0)) || '$입니다.' MESSAGE
        FROM EMP;

--7. 중복제거
SELECT DISTINCT JOB FROM EMP;
SELECT DISTINCT DEPTNO FROM EMP;

--연습문제'

--1. emp 테이블의 구조 출력
DESC EMP;
--2. emp 테이블의 모든 내용을 출력 
SELECT * FROM EMP;

--3. 현 scott 계정에서 사용가능한 테이블 출력
SELECT * FROM TAB;

--4. emp 테이블에서 사번, 이름, 급여, 업무, 입사일 출력
SELECT EMPNO, ENAME,SAL, HIREDATE, JOB FROM EMP;

--5. emp 테이블에서 급여가 2000미만인 사람의 사번, 이름, 급여 출력
SELECT EMPNO AS "사 번", ENAME  AS "이름",SAL AS"급여" 
    FROM EMP 
    WHERE SAL<2000;

--6. 입사일이 81/02이후에 입사한 사람의 사번, 이름, 업무, 입사일 출력

SELECT EMPNO, ENAME,SAL, HIREDATE,JOB FROM EMP WHERE HIREDATE>TO_DATE('81\03\01','RR/MM/DD');    

--7. 업무가 SALESMAN인 사람들 모든 자료 출력
SELECT * FROM EMP WHERE JOB='SALESMAN';

--8. 급여가 1500이상이고 3000이하인 사람의 사번, 이름, 급여 출력

SELECT EMPNO AS "사 번", ENAME  AS "이름",SAL AS"급여" FROM EMP WHERE 1500<=SAL AND SAL<=3000;

--9. 부서코드가 10번이거나 30인 사람의 사번, 이름, 업무, 부서코드 출력

SELECT EMPNO AS "사 번", ENAME  AS "이름",JOB AS "업무" FROM EMP WHERE DEPTNO=10 OR DEPTNO=30;

--10. 업무가 SALESMAN이거나 급여가 3000이상인 사람의 사번, 이름, 업무, 부서코드 출력

SELECT EMPNO AS "사 번", ENAME  AS "이름", JOB AS "업무",DEPTNO AS"부서" FROM EMP WHERE JOB='SALESMAN' OR SAL<=3000;

--11.“ename은 XXX 업무이고 연봉은 XX다” 스타일로 모두 출력(연봉은 SAL*12+COMM)
SELECT ENAME || '은' || JOB || '업무이고 연봉은' || (SAL*12+NVL(COMM,0)) || '$입니다.' MESSAGE    
            FROM EMP;


--8.SQL 연산자(BETWEEN, IN, LIKE,IS NULL)
    --(1) 필드명 BETWEEN A AND B : 필드명이 A부터 B까지(A,B포함)A<B
              --NOT BETWEEN A AND B : 필드명이 A미만 B초과(A,B미포함)A<B
        --EX. 급여가 1500이상이고 3000이하인 사람의 모든 필드 출력
        SELECT * FROM EMP WHERE SAL BETWEEN 1500 AND 3000;
        --SELECT * FROM EMP WHERE SAL BETWEEN 3000 AND 1500; 불가   
        --EX. 82년도에 입사한 사람의 모든 필드 출력
        SELECT * FROM EMP
            WHERE HIREDATE BETWEEN TO_DATE('82/01/01','RR/MM/DD') AND TO_DATE('82/05/31','RR/MM/DD');
        --EX. 급여가 1500미만,3000초과인 사람의 모든 필드 출력
        SELECT * FROM EMP WHERE SAL NOT BETWEEN 1500 AND 3000;
    --(2)필드명 IN(값1, 값2....값N):필드명이 값1,값2....값N인 경우
        --EX. 부서코드가 10번이거나 30인 사람의 사번, 이름, 부서코드 출력
        SELECT EMPNO,ENAME,DEPTNO FROM EMP WHERE DEPTNO IN(10,30);
        --EX. 부서코드가 10번, 20번, 40번을 제외한 직원의 모든 필드 출력 
        SELECT * FROM EMP WHERE NOT (DEPTNO=10 OR DEPTNO=20 OR DEPTNO=40);
        SELECT * FROM EMP WHERE DEPTNO NOT IN(10,20,40);
        --EX. 사번이 7902,7788,7566인 사원의 이름, 사번, 직책을 출력
        SELECT ENAME, EMPNO, JOB FROM EMP WHERE EMPNO IN (7902,7788,7566);
        
--(3) 필드명 LIKE 패턴 : %(0글자이상), _(한글자)가 포함된 패턴  
    --EX. 이름이 M으로 시작하는 사원의 모든 필드
    SELECT * FROM EMP WHERE ENAME LIKE 'M%';
    --EX. 이름에 N이 들어가는 사원의 모든 필드
    SELECT * FROM EMP WHERE ENAME LIKE '%N%';
    --EX. 이름이 'S'로끝나는 사원의 모든 필드
    SELECT * FROM EMP WHERE ENAME LIKE '%S';
    --EX. SAL이 5로 끝나는 사원의 모든 필드
    SELECT * FROM EMP WHERE SAL LIKE '%5';
    --EX. 82년도에 입사한 사원의 이름, 입사일을 출력
    SELECT ENAME,HIREDATE FROM EMP WHERE TO_CHAR(HIREDATE,'RR/MM/DD')LIKE '82%';
    --EX. 1월에 입사한 사원의 모든 필드
    SELECT * FROM EMP WHERE TO_CHAR(HIREDATE,'RR/MM/DD') LIKE '__/01/__';

--(4) IS NULL(NULL인지를 검색할때)
    --EX. 상여금이 NULL인 사원의 모든 필드
    SELECT * FROM EMP WHERE COMM IS NULL;
    --EX. 상여금이 없는 사원의 모든 필드(COMM이 NULL이거나 0)
    SELECT * FROM EMP WHERE COMM IS NULL OR COMM=0;
    --EX. 상여금을 받는 사원의 모든 필드(COMM이 NULL이 아니고 COMM이 0이 아닌사원)
    SELECT * FROM EMP WHERE COMM! = NULL AND COMM!=0;--불가
    SELECT * FROM EMP WHERE COMM IS NOT NULL AND COMM!=0;

--9.정렬(오름차순ASC, 내림차순DESC) : ORDER BY 절
SELECT ENAME, SAL, HIREDATE FROM EMP ORDER BY SAL,HIREDATE DESC, ENAME;
                    --급여 오름차순, 급여가 같으면 입사일 내림차순, 급여와 입사일이 같으면 이름 오름차순 정렬

/* ※형 변환 함수
짜형 -> 문자형 : TO_CHAR(날짜형, '패턴')
              YYYY(년도4자리) RR(년도2자리) YY(년도2자리) MM(월2자리), DD(일2자리) DY(수) DAY(수요일)
              HH24, HH12, AM이나PM, MI(분), SS(초)
숫자형 -> 문자형 : TO_CHAR(숫자형, '패턴') (ex)'9,999'
문자형 -> 날짜형 : TO_DATE('2026-08-19', 'YYYY-MM-DD')
*/

SELECT TO_CHAR(SAL, '9,999') 급여, TO_CHAR(HIREDATE, 'YYYY-MM-DD DY HH12:MI:SS') 입사일 FROM EMP;


-- <총 연습문제>

--1.	EMP 테이블에서 sal이 3000이상인 사원의 empno, ename, job, sal을 출력
SELECT EMPNO, ENAME, JOB, SAL 
    FROM EMP 
    WHERE  SAL>=3000;

--2.	EMP 테이블에서 empno가 7788인 사원의 ename과 deptno를 출력
SELECT ENAME,DEPTNO 
    FROM EMP 
    WHERE EMPNO IN (7788);

--3.	연봉(SAL*12+COMM)이 24000이상인 사번, 이름, 급여 출력 (급여순정렬)

SELECT EMPNO, ENAME, SAL 
    FROM EMP 
    WHERE SAL*12(COMM,0) >=24000 
    ORDER BY SAL;

--4.	입사일이 1981년 2월 20과 1981년 5월 1일 사이에 입사한 사원의 사원명, 직책, 입사일을 출력 (단 hiredate 순으로 출력)
SELECT ENAME,JOB,HIREDATE 
    FROM EMP 
    WHERE HIREDATE BETWEEN TO_DATE('81/02/20','RR/MM/DD') 
    AND TO_DATE('81/05/01','RR/MM/DD');

--5.	deptno가 10,20인 사원의 모든 정보를 출력 (단 ename순으로 정렬)
SELECT * FROM EMP WHERE DEPTNO IN(10,20)ORDER BY ENAME;

--6.	sal이 1500이상이고 deptno가 10,30인 사원의 ename과 sal를 출력
-- (단 출력되는 결과의 타이틀을 employee과 Monthly Salary로 출력)
SELECT ENAME AS"EMPLOYEE",SAL AS "MONTHLY SALARARY" 
    FROM EMP WHERE SAL>= 1500 AND DEPTNO IN (10,30);

-- 7.	hiredate가 1982년인 사원의 모든 정보를 출력
SELECT * FROM EMP 
    WHERE HIREDATE BETWEEN TO_DATE('82/01/01','RR/MM/DD')
    AND TO_DATE('82/12/31', 'RR/MM/DD');

-- 8.	입사일이81년이고 업무가 'SALESMAN'이 아닌 직원의 사번, 사원명, 입사일, 
--      업무, 급여를 검색하시오.
SELECT EMPNO,ENAME,HIREDATE,JOB,SAL 
    FROM EMP 
    WHERE HIREDATE BETWEEN TO_DATE('81/01/01','RR/MM/DD')
    AND TO_DATE('81/12/31', 'RR/MM/DD')
    AND JOB != 'SALESMAN';

-- 9.	사번, 사원명, 입사일, 업무, 급여를 급여가 높은 순으로 정렬하고, 
--      급여가 같으면 입사일이 빠른 사원으로 정렬하시오.
SELECT EMPNO, ENAME, HIREDATE, JOB, SAL 
    FROM EMP 
    ORDER BY SAL DESC,HIREDATE ;

--10.	사원명의 세 번째 알파벳이 'N'인 사원의 사번, 사원명을 검색하시오
SELECT * FROM EMP WHERE ENAME LIKE '__N%';

--11.	사원명에 'A'가 들어간 사원의 사번, 사원명을 출력
SELECT EMPNO, ENAME 
    FROM EMP 
    WHERE ENAME LIKE '%A%';

--12.	연봉(SAL*12)이 35000 이상인 사번, 사원명, 연봉을 검색 하시오.
SELECT EMPNO, ENAME, SAL*12 연봉
    FROM EMP    
    WHERE SAL*12 >35000;





































































