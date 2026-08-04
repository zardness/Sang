//자료형:undefine string, number, boolean, function, object(array), undefined, null
//underfined는 변수 초기화가 안되었을떄, null은 개발자가 인위적으로 null을 할당
var variable;
console.log('1.variable 타입:',typeof(variable),'-값',variable)
//variable = '이름은\' 홍길동\'입니다.';
let name = `홍길동`;
variable = `이름은'${name}'입니다.`;
console.log('2.variable 타입:', typeof(variable),'-값',variable);
variable = -3.2323;
console.log('3.variable 타입:', typeof(variable),'-값',variable);
variable = true;
console.log('4.variable 타입:', typeof(variable),'-값',variable);
variable = function(){
    alert( 'Hello');
};
console.log('5.variable 타입:', typeof(variable),'-값',variable);
variable = null;//null은 타입이 object
console.log('6.variable 타입:', typeof(variable),'-값',variable);