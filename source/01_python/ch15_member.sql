--회원가입 | 전체조회 | 이름찾기 | 메일삭제 | csv내보내기 
DROP TABLE MEMBER;
CREATE TABLE MEMBER(
    NAME VARCHAR2(20),
    PHONE VARCHAR2(30),
    EMAIL VARCHAR2(50),
    AGE NUMBER(3),
    GRADE NUMBER(1)   
);    
SELECT * FROM MEMBER

-- 1.회원가입 
INSERT INTO MEMBER VALUES ('홍길동','010-9999-9999','SH@j.com',25,1);
INSERT INTO MEMBER VALUES ('홍길동','010-7777-9999','abc@j.com',33,1);
-- 2. 전체조회 /5.csv내보내기
SELECT NAME , PHONE , EMAIL , AGE , GRADE  FROM MEMBER ORDER BY AGE;
-- 3. 이름으로 찾기
SELECT * FROM MEMBER WHERE NAME = '홍길동';
-- 4. 메일로 삭제
SELECT * FROM MEMBER WHERE upper (EMAIL)=upper('SH@j.com')

DELETE FROM MEMBER WHERE upper (EMAIL)=upper('SH@j.com');
commit;









