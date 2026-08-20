--[III] JOIN : 2개 이상의 테이블을 연결하여 데이터를 검색하는 방법
SELECT * FROM EMP WHERE ENAME ='SCOTT'; --1행
SELECT * FROM DEPT; --4행
--CORSS JOIN (FROM절에 태이블 2개 이상)
SELECT * FROM EMP, DEPT WHERE ENAME='SCOTT'; --EMP의 1행*DEPT의 4행이 

--▶ 1. EQUI JOIN : 공통필드 값이 일치되는 조건만 JOIN 
SELECT * FROM EMP, DEPT WHERE EMP.DEPTNO=DEPT.DEPINO;
SELECT E.*,DNAME,LOC
    FROM EMP E,DEPT D --14*4 = 56행
    WHERE E.DEPTNO=D.DEPTNO;
  --EX. 모든 사원의 사번, 이름,JOB,상사사번, 부서번호,부서명
    SELECT EMPNO, ENAME, JOB, E.DEPTNO, DNAME
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO;

  --EX. 급여가 2000이상인 진원의 이름, 직책, 급여, 부서명,  근무지 출력
    SELECT ENAME, JOB, SAL, DNAME, LOC 
        FROM EMP E, DEPT D 
        WHERE E.DEPTNO=D.DEPTNO AND SAL>=2000;

  --EX. 근무지가 'CHICAGI'인 직원의 이름, 업무, 급여, 부서번호
    SELECT ENAME, JOB, SAL, E.DEPTNO
        FROM EMP E,DEPT D
        WHERE LOC ='CHICAGO' 
            AND E.DEPTNO=D.DEPTNO;

  --EX. 상여금(COMM)이 없는 사원중, SAL이 1200이상인 사원의 이름, 급여,부서번호,부서명, 상여(부서명순, 급여큰순) 
    SELECT ENAME, SAL, E.DEPTNO, DNAME,COMM
        FROM EMP E,DEPT D
        WHERE E.DEPTNO=D.DEPTNO 
            AND COMM IS NOT NULL 
            AND COMM!=0 
            AND SAL>=1200;
-- 	탄탄EX.	뉴욕에서 근무하는 사원의 이름과 급여를 출력하시오
    SELECT ENAME,SAL 
        FROM EMP E,DEPT D 
        WHERE E.DEPTNO=D.DEPTNO 
            AND LOC='NEW YORK';

-- 	탄탄EX.	ACCOUNTING 부서 소속 사원의 이름과 입사일을 입사일을 최신순으로 출력하시오
    SELECT ENAME,HIREDATE
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO AND DNAME='ACCOUNTING'
        ORDER BY HIREDATE DESC;

-- 	탄탄EX.	직급이 MANAGER인 사원의 이름, 부서명을 출력하시오
    SELECT ENAME,DNAME
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO AND JOB='MANAGER';

-- 	탄탄EX.	Comm이 null이 아닌 사원의 이름, 급여, 부서코드, 근무지를 출력하시오.
    SELECT ENAME,SAL,E.DEPTNO, LOC 
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO AND COMM IS NOT NULL;

-- 	탄탄EX.	20번 부서와의 사원의 이름 급여 부서코드,근무지를 부서코드순으로 출력하시오
    SELECT ENAME, SAL, E.DEPTNO, LOC
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO AND E.DEPTNO!=20
        ORDER BY D.DEPTNO;
        
--▶2. NON-EQUI JOIN : 동일한 컬럼없이 다른 조건으로 조인
SELECT * FROM EMP WHERE ENAME='SCOTT'; --직원정보
SELECT * FROM SALGRADE; --급여등급정보(5행)
SELECT * FROM EMP, SALGRADE 
    WHERE ENAME='SCOTT' AND SAL BETWEEN LOSAL AND HISAL;

SELECT * FROM EMP, SALGRADE 
    WHERE SAL BETWEEN LOSAL AND HISAL;

--  EX. 모든사원의 사번, 이름, 직책, 상사사번, 급여, 급여등급(1등급,2등급)
SELECT EMPNO, ENAME, JOB, MGR, SAL, GRADE||'등급' GRADE
    FROM EMP, SALGRADE
    WHERE SAL BETWEEN LOSAL AND HISAL;
    
--탄탄 EX. Comm이 null이 아닌 사원의 이름, 급여, 등급, 부서번호, 부서이름, 근무지를 출력하시오.
    SELECT ENAME,SAL,GRADE,E.DEPTNO,DNAME,LOC
        FROM EMP E, DEPT D, SALGRADE
        WHERE E.DEPTNO=D.DEPTNO AND SAL BETWEEN LOSAL AND HISAL AND COMM IS NOT NULL;
        

--탄탄 EX. 이름, 급여, 입사일, 급여등급
    SELECT ENAME, SAL, HIREDATE, GRADE
        FROM EMP,SALGRADE 
        WHERE SAL BETWEEN LOSAL AND HISAL;

--탄탄 EX. 이름, 급여, 급여등급, 연봉, 부서명을 부서명순으로 정렬하여 출력. 부서가 같으면 연봉순. 연봉=(sal+comm)*12 comm이 null이면 0
    SELECT ENAME,SAL,GRADE,(SAL+NVL(comm,0))*12 ANNUAL_SAL,DNAME
        FROM EMP E, DEPT D, SALGRADE
        WHERE E.DEPTNO=D.DEPTNO AND SAL BETWEEN LOSAL AND HISAL
        ORDER BY DNAME,(SAL+NVL(comm,0))*12;

--탄탄 EX. 이름, 업무, 급여, 등급, 부서코드, 부서명 출력. 급여가 1000~3000사이. 정렬조건 : 부서별, 부서같으면 업무별, 업무같으면 급여 큰순
SELECT ENAME,JOB,SAL,GRADE,E.DEPTNO,DNAME
    FROM EMP E, SALGRADE,DEPT D
    WHERE SAL BETWEEN LOSAL AND HISAL AND E.DEPTNO=D.DEPTNO AND SAL BETWEEN 1000 AND 3000
    ORDER BY D.DEPTNO, JOB, SAL DESC;
--탄탄 EX. 이름, 급여, 등급, 입사일, 근무지. 81년에 입사한 사람. 등급 큰순
SELECT ENAME,SAL,GRADE,HIREDATE,LOC 
    FROM SALGRADE, EMP E,DEPT D
    WHERE SAL BETWEEN LOSAL AND HISAL AND E.DEPTNO=D.DEPTNO
        AND TO_CHAR(HIREDATE,'YY') = 81;


--▶3. SELF JOIN : 한태이블 내에서 조인
SELECT EMPNO, ENAME, MGR FROM EMP WHERE ENAME='SMITH';
SELECT EMPNO, ENAME, FROM EMP;--14행
-- 사번, 이름, 상사사번, 상사이름
SELECT WORKER.EMPNO,WORKER.ENAME,WORKER.MGR,MANAGER.EMPNO, MANAGER.ENAME
    FROM EMP WORKER, EMP MANAGER
    WHERE WORKER.ENAME='SMITH' AND WORKER.MGR=MANAGER.EMPNO;
    
SELECT W.EMPNO, W.ENAME, W.MGR, M.EMPNO 상사사번, M.ENAME 상사이름
    FROM EMP W, EMP M
    WHERE W.MGR=M.EMPNO;
    
-- EX. 'SMITH의 상사는 FORD이다.' 포맷으로 모든 직원출력
SELECT W.ENAME ||'의 상사는'|| M.ENAME ||'다' MESSAGE
    FROM EMP W, EMP M
    WHERE W.MGR=M.EMPNO;


--탄탄 EX. 매니저가 KING인 사원들의 이름과 직급을 출력하시오
SELECT W.ENAME,W.JOB
    FROM EMP W, EMP M
    WHERE W.MGR=M.EMPNO AND M.ENAME='KING';
    
--▶4. OUTER JOIN : EQUI-JOIN, NON-EQUI-JOIN, SELF-JOIN시 조건에 만족하지 않는 행까지 나타나게 하는 조인  
--(1) SELF-JOIN에서의 OUTER JOIN : 조건에 배제된 행을 결과에 포함시킬 경우, +기호를 정보가 부족한 컬럼에 붙임
SELECT W.ENAME, W.MGR, M.EMPNO,M.ENAME
    FROM EMP W, EMP M
    WHERE W.MGR=M.EMPNO(+);
-- EX. 'SMITH의 상사는 FORD다' 'KING의 상사는 없다'
SELECT W.ENAME ||'의 상사는'||NVL(M.ENAME,'없') ||'다'
    FROM EMP W, EMP M
    WHERE W.MGR = M.EMPNO(+);

-- EX. 사원명,상사사번,상사사번, 상사명
SELECT 부하.ENAME, 부하.MGR, 상사.ENAME, 상사.ENAME
    FROM EMP 부하, EMP 상사
    WHERE 부하.MGR=상사.EMPNO(+);

-- EX. 사원명,상사사번,상사사번, 상사명
SELECT 상사.ENAME, 상사.ENAME
    FROM EMP 부하, EMP 상사
    WHERE 부하.MGR(+)=상사.EMPNO AND 부하.ENAME IS NULL;
    
--(2) EQUI-JOIN에서의 OUTER-JOIN
SELECT * FROM DEPT;--10,20,30,40
SELECT * FROM EMP;--14행(10,20,30)
SELECT * FROM EMP E, DEPT D
    WHERE E.DEPTNO=D.DEPTNO;--40번 부서 출력안됨
SELECT * FROM EMP E, DEPT D
    WHERE E.DEPTNO(+)=D.DEPTNO;--40번 출력됨

-- ★ <연습문제>

Part1(EQUI JOIN, NON EQUI JOIN)
--1. 모든 사원에 대한 이름, 부서번호, 부서명을 출력하는 SELECT 문장을 작성하여라.
    SELECT ENAME,EMPNO, DNAME
        FROM EMP E, DEPT D
        WHERE E.DEPTNO=D.DEPTNO;

--2. NEW YORK에서 근무하고 있는 사원에 대하여 이름, 업무, 급여, 부서명을 출력
     SELECT ENAME, JOB, SAL, E.DEPTNO,DNAME
        FROM EMP E,DEPT D
        WHERE LOC ='NEW YORK' 
            AND E.DEPTNO=D.DEPTNO;


--3. 보너스를 받는 사원에 대하여 이름,부서명,위치를 출력
    SELECT ENAME,  DNAME, LOC
        FROM EMP E,DEPT D
        WHERE E.DEPTNO=D.DEPTNO 
            AND COMM IS NOT NULL 
            AND COMM!=0;

--4. 이름 중 L자가 있는 사원에 대하여 이름,업무,부서명,위치를 출력
    SELECT ENAME,JOB,DNAME,LOC
        FROM EMP E, DEPT D
            WHERE E.DEPTNO=D.DEPTNO AND ENAME LIKE '%L%';

--5. 사번, 사원명, 급여, 부서명을 출력(단, 급여가 2000이상인 사원에 대하여 급여를 기준으로 내림차순 정렬)
    SELECT EMPNO, ENAME, SAL, DNAME
        FROM EMP E,DEPT D
        WHERE E.DEPTNO=D.DEPTNO 
            AND SAL>=2000 
            ORDER BY SAL DESC;

--6. 사번, 사원명, 업무, 급여, 급여등급, 부서명을 출력(단, 업무가 MANAGER이며 급여가 2500이상인
-- 사원에 대하여 사번을 기준으로 오름차순정렬)
     SELECT EMPNO,ENAME,JOB,SAL,GRADE,DNAME
        FROM EMP E, DEPT D, SALGRADE S
        WHERE E.DEPTNO=D.DEPTNO 
        AND SAL BETWEEN S.LOSAL AND S.HISAL
        AND JOB='MANAGER' 
        AND SAL>=2500
        ORDER BY EMPNO;


Part2(4가지 JOIN 모두)
--1. 이름, 급여, 업무, 직속상사명
    SELECT W.ENAME, W.SAL, W.JOB , M.ENAME 상사이름
    FROM EMP W, EMP M
    WHERE W.MGR=M.EMPNO;

--2. 이름, 급여, 업무, 직속상사명 . (상사가 없는 직원까지 전체 직원 다 출력. 상사가 없을 시 '없음'으로 출력)
    SELECT W.ENAME,W.SAL,W.JOB,NVL(M.ENAME,'없음') AS 상사명
        FROM EMP W, EMP M
        WHERE W.MGR=M.EMPNO(+);
        

--3. 이름, 급여, 부서명, 직속상사명
    SELECT W.ENAME, W.SAL, D.DNAME, M.ENAME 상사이름
        FROM EMP W, EMP M,DEPT D
        WHERE W.MGR=M.EMPNO AND W.DEPTNO=D.DEPTNO;

--4. 상사가 없는 직원과 상사가 있는 직원 모두에 대해 이름, 급여, 부서코드, 부서명, 근무지, 직속상사명을 출력하시오(단, 직속상사가 없을 경우 직속상사명에는 ‘없음’으로 대신 출력하시오)
    SELECT W.ENAME,W.SAL,W.DEPTNO,D.DNAME,D.LOC, NVL(M.ENAME,'없음') AS 상사명
        FROM EMP W, EMP M, DEPT D
        WHERE W.MGR=M.EMPNO(+) AND W.DEPTNO=D.DEPTNO;
        
    
--5. 이름, 급여, 등급, 부서명, 직속상사명. 급여가 2000이상인 사람
    SELECT W.ENAME, W.SAL,GRADE, DNAME, NVL(M.ENAME,'없음') AS 상사명
        FROM EMP W, EMP M, DEPT D, SALGRADE 
        WHERE W.MGR=M.EMPNO(+) 
        AND W.DEPTNO = D.DEPTNO 
        AND W.SAL BETWEEN LOSAL AND HISAL 
        AND W.SAL>=2000;

--6. 이름, 급여, 급여등급, 부서명, 연봉, 직속상사명. 연봉=(SAL+COMM)*12으로 계산하여 출력
    SELECT W.ENAME, W.SAL, GRADE, DNAME, NVL(M.ENAME,'없음') AS 상사명,(W.SAL+NVL(W.comm,0))*12 ANNUAL_SAL
        FROM EMP W, EMP M, DEPT D, SALGRADE 
        WHERE W.DEPTNO=D.DEPTNO 
            AND W.MGR = M.EMPNO(+)
            AND W.SAL BETWEEN LOSAL AND HISAL;
--7. 6번을 부서명 순으로 오름차순 정렬하여 출력(부서가 같으면 급여가 큰 순 정렬) 
    SELECT W.ENAME, W.SAL,S.GRADE, D.DNAME, NVL(M.ENAME,'없음') AS 상사명,(W.SAL+NVL(W.comm,0))*12 ANNUAL_SAL
        FROM EMP W, EMP M, DEPT D, SALGRADE S
        WHERE W.DEPTNO=D.DEPTNO 
            AND W.MGR = M.EMPNO(+)
            AND W.SAL BETWEEN S.LOSAL AND S.HISAL
            ORDER BY DNAME, SAL DESC;
        
    