//자료형:undefine string, number, boolean, function, object(array), undefined, null
//underfined는 변수 초기화가 안되었을떄, null은 개발자가 인위적으로 null을 할당
var variable;
document.write('1.variable 타입:',typeof(variable),'-값',variable)
//variable = '이름은\' 홍길동\'입니다.';
let name = `홍길동`;
variable = `이름은'${name}'입니다.`;
document.write('2.variable 타입:', typeof(variable),'-값',variable);
variable = -3.2323;
document.write('3.variable 타입:', typeof(variable),'-값',variable);
variable = true;
document.write('4.variable 타입:', typeof(variable),'-값',variable);
variable = function(){
    alert( 'Hello');
};
variable();//함수호출
document.write('5.variable 타입:', typeof(variable),'-값',variable);
variable = null;//null은 타입이 object
document.write('6.variable 타입:', typeof(variable),'-값',variable);
variable = {'name':'홍길동','age':20};//객체
document.write1('7.variable타입:',typeof(variable),'-값',variable);
variable = ['홍길동',20,function(){},true,[1,2],{'name':'홍길동'}];//배열
document.write1('8.variable타입:',typeof(variable),'-값',variable);