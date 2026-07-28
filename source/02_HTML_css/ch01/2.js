// JavaScript source code
/* 2.js */
name = prompt("이름은?", "홍길동"); // 취소를 클릭하면 'null'
if (name != 'null' && name != '') {
    document.write(name + '님 방가방가<br><br>');
}