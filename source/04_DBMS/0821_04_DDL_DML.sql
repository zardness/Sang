--[IV] DCL,DDL,DML
/* SQL 
(1) DCL : 사용자 계정생성(CREATE USER), 권한부여(GRANT), 권한박탈(REVOKE), 사용자 계정삭제(DROP USER)
          트렌젝션 명령어 (ROLLBACK, COMMIT)
(2) DDL : 테이블 생성(CREATE TABLE), 태이블구조변경(ALTER TABLE), 태이블 삭제(DROP TABLE)
(3) DML :CRUD
        입력(INSERT), 수정(UPDATE), 삭제(DELETE)-취소(ROLLBACK)가능
        검색(SELECT),
*/
---------------
--- ★ DDL ★---
---------------
--1. 태이블 생성(CREATE TABLE 태이블명...) : 태이블 구조 정의 
    --ORACLE 타입 : NUMBER(38이하의 자릿수),DATE,VARCHAR2(4000이하의 바이트수),CLOB
CREATE TABLE BOOK(
    BOOKID    NUMBER(4)PRIMARY KEY,    --BOOKID필드의 타입은 숫자4자리
    BOOKNAME  VARCHAR2(30), --BOOKNAME필드의 타입은 문자 30BYTE(한글 1자=3BYTE)
    PUBLISHER VARCHAR2(30), 
    RDATE     DATE,         --RDATE 필드의 타입은 DATE(날짜+시간)
    PRICE     NUMBER(8,2),  --PRICE필드의 타입은 숫자 전체8자리 중 소숫점 2자리
    PRIMARY KEY(BOOKID)     --제약조건 : BOOKID를 주키(PRIMARY KEY)로
);
--DESC BOOK;
--SELECT * FROM BOOK;
--DROP TABLE BOOK; -- 2. 태이블삭제(DROP TABLE 태이블명


CREATE TABLE BOOK(
    BOOKID    NUMBER(4)PRIMARY KEY, --제약조건   
    BOOKNAME  VARCHAR2(30), 
    PUBLISHER VARCHAR2(30), 
    RDATE     DATE,         
    PRICE     NUMBER(8,2),  
         -
);
DROP TABLE BOOK;
DROP TABLE DEPT

